import { useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Feedback } from "../../lib/llm";

interface CodeViewerProps {
  code: string;
  feedback?: Feedback;
  selectedFile?: string;
}

export default function CodeViewer({
  code,
  feedback,
  selectedFile,
}: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const hasLineComments =
    feedback && Object.keys(feedback.lineComments).length > 0;

  if (!code.trim()) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">No file selected</p>
          <p className="text-gray-400 text-sm">
            Upload student submissions to view code
          </p>
        </div>
      </div>
    );
  }

  const customStyle = {
    ...oneLight,
    'pre[class*="language-"]': {
      ...oneLight['pre[class*="language-"]'],
      margin: 0,
      padding: 0,
      background: "transparent",
    },
    'code[class*="language-"]': {
      ...oneLight['code[class*="language-"]'],
      background: "transparent",
    },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">
          {selectedFile || "Code Viewer"}
        </h3>
        {hasLineComments && (
          <div className="text-sm text-gray-500">
            {Object.keys(feedback.lineComments).length} comment(s)
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="relative">
          <SyntaxHighlighter
            language="python"
            style={customStyle}
            showLineNumbers={true}
            lineNumberStyle={{
              minWidth: "3em",
              paddingRight: "1em",
              color: "#6B7280",
              borderRight: "1px solid #E5E7EB",
              marginRight: "1em",
              userSelect: "none",
            }}
            customStyle={{
              fontSize: "14px",
              lineHeight: "1.5",
              margin: 0,
              background: "white",
            }}
            lineProps={() => ({})}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}
