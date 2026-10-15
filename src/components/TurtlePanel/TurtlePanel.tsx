import { useRef, useState, useEffect } from 'react';
import { Student } from '@/components/StudentList/types';
import { analyzeTurtleOutput } from '@/lib/llm';

// ── Pyodide type shim (loaded from CDN at runtime) ──────────────────────────
declare global {
  interface Window {
    loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInstance>;
  }
}
interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { get: (key: string) => unknown };
}

// ── Canvas turtle module injected into Pyodide's sys.modules ────────────────
// Written as a Python string; references `js.document` via Pyodide's JS bridge.
const TURTLE_MODULE_PY = `
import sys, types, math
import js as _js

# ── internal canvas state ───────────────────────────────────────────────────
_canvas = _js.document.getElementById('turtle-canvas')
_ctx = _canvas.getContext('2d')

def _clear_canvas():
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height)
    _ctx.fillStyle = 'white'
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height)

_clear_canvas()

# ── Turtle class ─────────────────────────────────────────────────────────────
class Turtle:
    def __init__(self):
        self._x = float(_canvas.width) / 2
        self._y = float(_canvas.height) / 2
        self._angle = 90.0   # 0=east, 90=north (standard turtle coords)
        self._pen = True
        self._pen_color = 'black'
        self._fill_color = 'black'
        self._filling = False
        self._fill_pts = []
        self._pen_width = 1

    # ── motion ───────────────────────────────────────────────────────────────
    def forward(self, dist):
        rad = math.radians(self._angle)
        nx = self._x + dist * math.cos(rad)
        ny = self._y - dist * math.sin(rad)   # canvas y is flipped
        if self._pen:
            _ctx.beginPath()
            _ctx.strokeStyle = self._pen_color
            _ctx.lineWidth = self._pen_width
            _ctx.moveTo(self._x, self._y)
            _ctx.lineTo(nx, ny)
            _ctx.stroke()
        if self._filling:
            self._fill_pts.append((nx, ny))
        self._x, self._y = nx, ny
    fd = forward

    def backward(self, dist): self.forward(-dist)
    bk = backward
    back = backward

    def left(self, a): self._angle += a
    lt = left
    def right(self, a): self._angle -= a
    rt = right

    def goto(self, x, y=None):
        if y is None and hasattr(x, '__len__'):
            x, y = x[0], x[1]
        cx = float(_canvas.width) / 2 + x
        cy = float(_canvas.height) / 2 - y
        if self._pen:
            _ctx.beginPath()
            _ctx.strokeStyle = self._pen_color
            _ctx.lineWidth = self._pen_width
            _ctx.moveTo(self._x, self._y)
            _ctx.lineTo(cx, cy)
            _ctx.stroke()
        if self._filling:
            self._fill_pts.append((cx, cy))
        self._x, self._y = cx, cy
    setpos = goto
    setposition = goto

    def setx(self, x): self.goto(x, self.ycor())
    def sety(self, y): self.goto(self.xcor(), y)
    def xcor(self): return self._x - float(_canvas.width) / 2
    def ycor(self): return float(_canvas.height) / 2 - self._y
    def pos(self): return (self.xcor(), self.ycor())
    position = pos

    def home(self):
        self._x = float(_canvas.width) / 2
        self._y = float(_canvas.height) / 2
        self._angle = 90.0

    def setheading(self, a): self._angle = float(a)
    seth = setheading
    def heading(self): return self._angle

    def circle(self, radius, extent=360, steps=None):
        if steps is None:
            steps = max(int(abs(radius) * math.radians(abs(extent))), 4)
        step_angle = float(extent) / steps
        step_dist = 2 * abs(radius) * math.sin(math.radians(step_angle / 2))
        sign = 1 if radius > 0 else -1
        for _ in range(steps):
            self.forward(sign * step_dist)
            if radius > 0: self.left(step_angle)
            else:          self.right(step_angle)

    def dot(self, size=None, *color):
        r = (size or (self._pen_width + 4)) / 2
        c = color[0] if color else self._fill_color
        _ctx.beginPath()
        _ctx.arc(self._x, self._y, r, 0, 2 * math.pi)
        _ctx.fillStyle = c
        _ctx.fill()

    # ── pen control ───────────────────────────────────────────────────────────
    def penup(self):   self._pen = False
    pu = penup; up = penup
    def pendown(self): self._pen = True
    pd = pendown; down = pendown
    def isdown(self): return self._pen

    def pensize(self, w=None):
        if w is not None: self._pen_width = w
        return self._pen_width
    width = pensize

    def pencolor(self, *a):
        if a: self._pen_color = a[0] if len(a) == 1 else 'rgb(%d,%d,%d)' % (int(a[0]*255), int(a[1]*255), int(a[2]*255))
        return self._pen_color

    def fillcolor(self, *a):
        if a: self._fill_color = a[0] if len(a) == 1 else 'rgb(%d,%d,%d)' % (int(a[0]*255), int(a[1]*255), int(a[2]*255))
        return self._fill_color

    def color(self, *a):
        if len(a) == 1:   self._pen_color = self._fill_color = a[0]
        elif len(a) == 2: self._pen_color, self._fill_color = a[0], a[1]
        elif len(a) == 3:
            c = 'rgb(%d,%d,%d)' % (int(a[0]*255), int(a[1]*255), int(a[2]*255))
            self._pen_color = self._fill_color = c

    # ── fill ─────────────────────────────────────────────────────────────────
    def begin_fill(self):
        self._filling = True
        self._fill_pts = [(self._x, self._y)]

    def end_fill(self):
        if len(self._fill_pts) > 1:
            _ctx.beginPath()
            _ctx.moveTo(self._fill_pts[0][0], self._fill_pts[0][1])
            for px, py in self._fill_pts[1:]:
                _ctx.lineTo(px, py)
            _ctx.closePath()
            _ctx.fillStyle = self._fill_color
            _ctx.fill()
        self._filling = False
        self._fill_pts = []

    # ── misc ─────────────────────────────────────────────────────────────────
    def speed(self, s=None): pass
    def hideturtle(self): pass
    ht = hideturtle
    def showturtle(self): pass
    st = showturtle
    def isvisible(self): return True

    def write(self, text, move=False, align='left', font=('Arial', 8, 'normal')):
        _ctx.font = f'{font[1]}px {font[0]}'
        _ctx.fillStyle = self._pen_color
        _ctx.fillText(str(text), self._x, self._y)

    def clear(self): _clear_canvas()
    def reset(self):
        _clear_canvas()
        self.home()
        self._pen = True
        self._pen_color = 'black'
        self._fill_color = 'black'

# ── module-level default turtle + forwarding functions ───────────────────────
_t = None
def _dt():
    global _t
    if _t is None: _t = Turtle()
    return _t

def forward(d): _dt().forward(d)
def fd(d): _dt().forward(d)
def backward(d): _dt().backward(d)
def bk(d): _dt().backward(d)
def back(d): _dt().backward(d)
def left(a): _dt().left(a)
def lt(a): _dt().left(a)
def right(a): _dt().right(a)
def rt(a): _dt().right(a)
def penup(): _dt().penup()
def pu(): _dt().penup()
def up(): _dt().penup()
def pendown(): _dt().pendown()
def pd(): _dt().pendown()
def down(): _dt().pendown()
def isdown(): return _dt().isdown()
def goto(x, y=None): _dt().goto(x, y)
def setpos(x, y=None): _dt().goto(x, y)
def setposition(x, y=None): _dt().goto(x, y)
def setx(x): _dt().setx(x)
def sety(y): _dt().sety(y)
def xcor(): return _dt().xcor()
def ycor(): return _dt().ycor()
def pos(): return _dt().pos()
def position(): return _dt().pos()
def home(): _dt().home()
def setheading(a): _dt().setheading(a)
def seth(a): _dt().setheading(a)
def heading(): return _dt().heading()
def circle(r, extent=360, steps=None): _dt().circle(r, extent, steps)
def dot(size=None, *c): _dt().dot(size, *c)
def pensize(w=None): return _dt().pensize(w)
def width(w=None): return _dt().pensize(w)
def pencolor(*a): return _dt().pencolor(*a)
def fillcolor(*a): return _dt().fillcolor(*a)
def color(*a): _dt().color(*a)
def begin_fill(): _dt().begin_fill()
def end_fill(): _dt().end_fill()
def write(text, move=False, align='left', font=('Arial', 8, 'normal')): _dt().write(text, move, align, font)
def speed(s=None): pass
def hideturtle(): pass
def ht(): pass
def showturtle(): pass
def st(): pass
def clear(): _clear_canvas()
def reset(): _dt().reset()

def bgcolor(c):
    _ctx.fillStyle = c
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height)

class Screen:
    def bgcolor(self, c): bgcolor(c)
    def setup(self, *a, **kw): pass
    def title(self, t): pass
    def tracer(self, *a, **kw): pass
    def update(self): pass

def done(): pass
def mainloop(): pass
def bye(): pass
def setup(*a, **kw): pass
def tracer(*a, **kw): pass
def update(): pass
def delay(*a): pass
def title(t): pass
def screensize(*a): pass

# ── inject as sys.modules['turtle'] ─────────────────────────────────────────
_mod = types.ModuleType('turtle')
_mod.__dict__.update({k: v for k, v in list(globals().items()) if not k.startswith('_')})
_mod.Turtle = Turtle
_mod.Screen = Screen
sys.modules['turtle'] = _mod
`;

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

interface TurtlePanelProps {
  student: Student | null;
  apiKey: string;
  assignmentName: string;
}

type RunStatus = 'idle' | 'loading-pyodide' | 'running' | 'done' | 'error';

export default function TurtlePanel({ student, apiKey, assignmentName }: TurtlePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pyodideRef = useRef<PyodideInstance | null>(null);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<{ comments: string[]; reasoning: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Detect if current student code uses turtle
  const codeFiles = student?.submissionFiles ?? [];
  const turtleFile = codeFiles.find(f =>
    /import turtle|from turtle\s+import/.test(f.content)
  );

  useEffect(() => {
    // Reset output when student changes
    setStatus('idle');
    setErrorMsg('');
    setAiAnalysis(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [student?.email]);

  const loadPyodide = async (): Promise<PyodideInstance> => {
    if (pyodideRef.current) return pyodideRef.current;

    // Inject CDN script tag if not already loaded
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${PYODIDE_CDN}pyodide.js`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Pyodide from CDN'));
        document.head.appendChild(script);
      });
    }

    const py = await window.loadPyodide({ indexURL: PYODIDE_CDN });
    pyodideRef.current = py;
    return py;
  };

  const handleRun = async () => {
    if (!turtleFile || !canvasRef.current) return;

    setStatus('loading-pyodide');
    setErrorMsg('');
    setAiAnalysis(null);

    // Clear canvas
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    try {
      const py = await loadPyodide();
      setStatus('running');

      // Inject our canvas-backed turtle module
      await py.runPythonAsync(TURTLE_MODULE_PY);

      // Run student code (exceptions surface as JS errors)
      await py.runPythonAsync(turtleFile.content);

      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!canvasRef.current || !turtleFile) return;
    if (!apiKey) {
      alert('Add your OpenAI API key under AI Feedback Settings first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Capture canvas as base64 PNG
      const dataURL = canvasRef.current.toDataURL('image/png');
      const base64 = dataURL.split(',')[1];

      const result = await analyzeTurtleOutput(
        turtleFile.content,
        base64,
        assignmentName,
        apiKey,
      );
      setAiAnalysis(result);
    } catch (err) {
      alert(`AI analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!student) return null;
  if (!turtleFile) {
    return (
      <div style={{
        background: '#393E46', borderRadius: '8px', padding: '16px',
        color: '#948979', fontSize: '13px', textAlign: 'center',
      }}>
        No turtle code detected in this submission.
      </div>
    );
  }

  const statusLabel: Record<RunStatus, string> = {
    idle: '',
    'loading-pyodide': 'Loading Python runtime…',
    running: 'Running code…',
    done: 'Done',
    error: 'Error',
  };

  return (
    <div style={{
      background: '#393E46', borderRadius: '8px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: '0',
    }}>
      {/* Header */}
      <div style={{
        background: '#2a2f38', padding: '10px 14px',
        borderBottom: '1px solid #4a5568',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ color: '#DFD0B8', fontWeight: 700, fontSize: '13px' }}>
            Turtle Output
          </span>
          <span style={{ color: '#948979', fontSize: '11px', marginLeft: '8px' }}>
            {turtleFile.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {status !== 'idle' && (
            <span style={{ color: status === 'error' ? '#f44336' : '#4caf83', fontSize: '11px' }}>
              {statusLabel[status]}
            </span>
          )}
          <button
            onClick={handleRun}
            disabled={status === 'loading-pyodide' || status === 'running'}
            style={{
              background: '#2e4a3c', color: '#4caf83', border: '1px solid #4caf83',
              padding: '4px 12px', borderRadius: '5px', fontSize: '12px',
              cursor: status === 'running' || status === 'loading-pyodide' ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: status === 'running' || status === 'loading-pyodide' ? 0.6 : 1,
            }}
          >
            {status === 'loading-pyodide' ? 'Loading…' : status === 'running' ? 'Running…' : '▶ Run'}
          </button>
          {status === 'done' && (
            <button
              onClick={handleAnalyzeWithAI}
              disabled={isAnalyzing}
              style={{
                background: '#2d3a4a', color: '#64b5f6', border: '1px solid #64b5f6',
                padding: '4px 12px', borderRadius: '5px', fontSize: '12px',
                cursor: isAnalyzing ? 'not-allowed' : 'pointer', fontWeight: 600,
                opacity: isAnalyzing ? 0.6 : 1,
              }}
            >
              {isAnalyzing ? 'Analyzing…' : '✦ AI Analyze'}
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ background: '#fff', display: 'flex', justifyContent: 'center', padding: '8px' }}>
        <canvas
          ref={canvasRef}
          id="turtle-canvas"
          width={460}
          height={360}
          style={{ display: 'block', border: '1px solid #ccc' }}
        />
      </div>

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div style={{
          padding: '10px 14px', background: '#3d1a1a',
          borderTop: '1px solid #f44336',
        }}>
          <p style={{ color: '#f44336', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
            {errorMsg}
          </p>
        </div>
      )}

      {/* AI Analysis */}
      {aiAnalysis && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #4a5568' }}>
          {aiAnalysis.reasoning && (
            <p style={{ color: '#948979', fontSize: '12px', lineHeight: 1.5, marginBottom: '8px' }}>
              <strong style={{ color: '#DFD0B8' }}>AI Assessment: </strong>
              {aiAnalysis.reasoning}
            </p>
          )}
          {aiAnalysis.comments.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {aiAnalysis.comments.map((c, i) => (
                <li key={i} style={{ color: '#948979', fontSize: '12px' }}>• {c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Note on CDN load */}
      {status === 'idle' && (
        <p style={{ color: '#948979', fontSize: '11px', padding: '6px 14px', borderTop: '1px solid #393E46', margin: 0 }}>
          First run downloads the Python runtime (~25 MB) from CDN and caches it in the browser.
        </p>
      )}
    </div>
  );
}
