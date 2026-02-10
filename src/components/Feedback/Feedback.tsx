import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import 'bootstrap-icons/font/bootstrap-icons.css';
import { FeedbackItem, SortField, SortDirection } from './types';
import { Student, ChangeRecord } from '@/components/StudentList/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import { Search, X } from 'lucide-react';

interface SortableItemProps {
  id: number;
  item: FeedbackItem;
  editingId: number | null;
  editingText: string;
  editingDeduction: number;
  appliedIds: number[];
  selectedStudent: string | null;
  selectedStudents: Set<string>;
  onStartEdit: (item: FeedbackItem) => void;
  onAcceptEdit: (id: number) => void;
  onRejectEdit: () => void;
  onApplyFeedback: (item: FeedbackItem) => void;
  onDeleteFeedback: (id: number) => void;
  setEditingText: (text: string) => void;
  setEditingDeduction: (value: number) => void;
  onFeedbackSelect?: (id: number) => void;
  selectedFeedbackId?: number | null;
}

const SortableItem = ({
  id,
  item,
  editingId,
  editingText,
  editingDeduction,
  appliedIds,
  selectedStudent,
  selectedStudents,
  onStartEdit,
  onAcceptEdit,
  onRejectEdit,
  onApplyFeedback,
  onDeleteFeedback,
  setEditingText,
  setEditingDeduction,
  onFeedbackSelect,
  selectedFeedbackId,
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    data: {
      type: 'feedback-item',
      item
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
  } as React.CSSProperties;

  const isSelected = selectedFeedbackId === item.id;
  const hasSelectedStudents = selectedStudent || (selectedStudents && selectedStudents.size > 0);

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        ...style,
        background: isDragging ? '#393E46' : 'transparent'
      }}
      className={`${isDragging ? 'dragging' : ''} border-b-0 transition-colors mb-1`}
      onMouseEnter={(e) => !isDragging && (e.currentTarget.style.background = '#393E46')}
      onMouseLeave={(e) => !isDragging && (e.currentTarget.style.background = 'transparent')}
      data-is-dragging={isDragging || undefined}
      data-feedback-id={id}
    >
      {editingId === item.id ? (
        <>
          <TableCell>
            <Textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="min-h-[40px] resize-y p-1"
              style={{ background: '#393E46', border: '1px solid #948979', color: '#DFD0B8' }}
            />
          </TableCell>
          <TableCell>
            <div className="flex justify-center">
              <Input
                type="number"
                value={editingDeduction}
                onChange={(e) => setEditingDeduction(Number(e.target.value))}
                className="w-[60px] p-1 text-center"
                style={{ background: '#393E46', border: '1px solid #948979', color: '#DFD0B8' }}
                min={0}
                max={20}
              />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex space-x-1">
              <Button
                onClick={() => onAcceptEdit(item.id)}
                className="p-1"
                style={{ background: '#4CAF50', color: '#DFD0B8' }}
                size="sm"
              >
                ✓
              </Button>
              <Button
                onClick={onRejectEdit}
                className="p-1"
                style={{ background: '#f44336', color: '#DFD0B8' }}
                size="sm"
              >
                ✕
              </Button>
            </div>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="p-0 py-0.5">
            <div
              className="py-0.5 pl-1 pr-2 rounded transition-colors whitespace-pre-wrap break-words text-sm flex items-center border-l-2"
              style={{
                background: isDragging
                  ? '#393E46'
                  : isSelected
                    ? '#2d4a3e'
                    : appliedIds.includes(item.id)
                      ? '#2d4a3e'
                      : '#222831',
                borderColor: isDragging
                  ? '#948979'
                  : isSelected
                    ? '#4CAF50'
                    : appliedIds.includes(item.id)
                      ? '#4CAF50'
                      : '#948979',
                color: '#DFD0B8',
                boxShadow: isDragging ? '0 4px 6px rgba(0, 0, 0, 0.3)' : 'none'
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  e.stopPropagation();
                  if (onFeedbackSelect) {
                    onFeedbackSelect(item.id);
                  }
                }
              }}
            >
              <div
                {...attributes}
                {...listeners}
                className="cursor-move inline-block opacity-60 hover:opacity-100 flex-shrink-0"
                title="Drag to reorder"
                aria-label="Drag handle"
                role="button"
                tabIndex={0}
              >
                <i className="bi bi-grip-vertical" style={{ color: '#948979' }}></i>
              </div>
              <span
                className="cursor-pointer p-0.5 rounded transition-colors inline-block ml-0.5 flex-grow"
                style={{
                  background: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#393E46'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.ctrlKey || e.metaKey) {
                    onStartEdit(item);
                  } else if (onFeedbackSelect) {
                    onFeedbackSelect(item.id);
                  }
                }}
              >
                {item.comment}
              </span>
            </div>
          </TableCell>
          <TableCell
            className="text-center cursor-pointer w-16 p-0 py-0.5"
            style={{ color: '#DFD0B8' }}
            onClick={() => onStartEdit(item)}
          >
            {item.grade}
          </TableCell>
          <TableCell className="p-0 py-0.5 text-center">
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasSelectedStudents}
              onClick={() => {
                if (hasSelectedStudents) {
                  onApplyFeedback(item);
                }
              }}
              className="w-5 h-5 rounded-full"
              style={{
                background: hasSelectedStudents && appliedIds.includes(item.id)
                  ? '#DFD0B8'
                  : 'transparent',
                border: `1px solid ${hasSelectedStudents && appliedIds.includes(item.id) ? '#DFD0B8' : '#948979'}`,
                boxShadow: hasSelectedStudents && appliedIds.includes(item.id) ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none'
              }}
            >
              {hasSelectedStudents && appliedIds.includes(item.id) ? (
                <i className="bi bi-check" style={{ color: '#222831' }}></i>
              ) : (
                <span></span>
              )}
            </Button>
          </TableCell>
          <TableCell className="p-0 py-0.5">
            <div className="flex space-x-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStartEdit(item)}
                className="px-1.5 hover:bg-transparent"
                style={{ color: '#948979' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#DFD0B8'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#948979'}
              >
                <i className="bi bi-pencil"></i>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteFeedback(item.id)}
                className="px-1.5 hover:bg-transparent"
                style={{ color: '#f44336' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#d32f2f'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#f44336'}
              >
                <i className="bi bi-trash"></i>
              </Button>
            </div>
          </TableCell>
        </>
      )}
    </TableRow>
  );
};

// Define CSS classes for animation
const fadeInClass = "opacity-100 transform translate-y-0 transition-all duration-200 ease-out";
const fadeOutClass = "opacity-0 transform -translate-y-2 transition-all duration-200 ease-out";

interface Props {
  selectedStudent: string | null;
  selectedStudents: Set<string>;
  appliedIds: number[];
  onFeedbackEdit: (oldFeedback: FeedbackItem, newFeedback: FeedbackItem) => void;
  feedbackItems: FeedbackItem[];
  setFeedbackItems: React.Dispatch<React.SetStateAction<FeedbackItem[]>>;
  onStudentsUpdate: React.Dispatch<React.SetStateAction<Student[]>>;
  onChangeTracked: (change: ChangeRecord) => void;
  onFeedbackSelect: (feedbackId: number | null) => void;
  selectedFeedbackId: number | null;
  maxPoints: number;
}

const Feedback: React.FC<Props> = ({
  selectedStudent,
  selectedStudents,
  appliedIds,
  onFeedbackEdit,
  feedbackItems,
  setFeedbackItems,
  onStudentsUpdate,
  onChangeTracked,
  onFeedbackSelect,
  selectedFeedbackId,
  maxPoints
}) => {
  const [isAddingFeedback, setIsAddingFeedback] = useState(false);
  const [newFeedback, setNewFeedback] = useState<Omit<FeedbackItem, 'id' | 'applied'>>({ 
    comment: "", 
    grade: 0 
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDeduction, setEditingDeduction] = useState(0);
  const [sortField, setSortField] = useState<SortField>('text');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [reusableIds, setReusableIds] = useState<number[]>([]);
  const [nextId, setNextId] = useState<number>(5);
  const [useManualOrder, setUseManualOrder] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FeedbackItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchBarVisible, setIsSearchBarVisible] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        tolerance: 5,
        delay: 50,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleApplyFeedback = (feedbackItem: FeedbackItem) => {
    onStudentsUpdate(prevStudents =>
      prevStudents.map(student => {
        if (selectedStudents.has(student.name) || student.name === selectedStudent) {
          const appliedIds = Array.isArray(student.appliedIds) ? student.appliedIds : [];
          const isAlreadyApplied = appliedIds.includes(feedbackItem.id);

          let newAppliedIds: number[];
          let newFeedback: string;

          if (isAlreadyApplied) {
            // Remove the feedback
            newAppliedIds = appliedIds.filter(id => id !== feedbackItem.id);
            newFeedback = student.feedback
              .split('\n')
              .filter(line => !line.trim().startsWith(feedbackItem.comment.trim()))
              .join('\n');
          } else {
            // Add the feedback
            newAppliedIds = [...appliedIds, feedbackItem.id];
            newFeedback = student.feedback
              ? `${student.feedback}\n${feedbackItem.comment}`
              : feedbackItem.comment;
          }

          // Calculate total deduction from all applied feedback items
          const totalDeduction = newAppliedIds.reduce((sum, id) => {
            const feedback = feedbackItems.find(f => f.id === id);
            return sum + (feedback?.grade || 0);
          }, 0);

          // Use maxPoints prop instead of hardcoded value
          const calculatedGrade = Math.max(0, maxPoints - totalDeduction);
          
          // Set grade to blank if no feedback is applied
          const newGrade = newAppliedIds.length > 0 ? calculatedGrade.toString() : '';

          const oldState = {
            grade: student.grade,
            feedback: student.feedback,
            appliedIds: [...appliedIds]
          };

          const newState = {
            ...student,
            grade: newGrade,
            feedback: newFeedback.trim(),
            appliedIds: newAppliedIds
          };

          onChangeTracked({
            type: 'feedback',
            studentName: student.name,
            oldValue: oldState,
            newValue: newState,
            timestamp: new Date().toISOString()
          });

          return newState;
        }
        return student;
      })
    );
  };

  const handleAddFeedback = () => {
    if (newFeedback.comment.trim()) {
      let idToUse: number;
      
      if (reusableIds.length > 0) {
        idToUse = Math.min(...reusableIds);
        setReusableIds(prev => prev.filter(id => id !== idToUse));
      } else {
        idToUse = nextId;
        setNextId(prev => prev + 1);
      }

      setFeedbackItems([
        ...feedbackItems,
        {
          id: idToUse,
          comment: newFeedback.comment,
          grade: Number(newFeedback.grade),
          applied: false
        }
      ]);
      setNewFeedback({ comment: "", grade: 0 });
      setIsAddingFeedback(false);
    }
  };

  const handleStartEdit = (item: FeedbackItem) => {
    setEditingId(item.id);
    setEditingText(item.comment);
    setEditingDeduction(item.grade);
  };

  const handleAcceptEdit = (id: number) => {
    const oldFeedback = feedbackItems.find(item => item.id === id);
    const newFeedback = {
      id,
      comment: editingText,
      grade: editingDeduction,
    };

    setFeedbackItems(feedbackItems.map(item =>
      item.id === id 
        ? { ...item, comment: editingText, grade: editingDeduction } 
        : item
    ));

    if (oldFeedback && appliedIds.includes(id)) {
      onFeedbackEdit(oldFeedback, newFeedback);
    }

    setEditingId(null);
  };

  const handleRejectEdit = () => {
    setEditingId(null);
  };

  const handleDeleteFeedback = (id: number) => {
    const feedbackToDelete = feedbackItems.find(item => item.id === id);
    
    if (feedbackToDelete) {
      onStudentsUpdate(prevStudents =>
        prevStudents.map(student => {
          if (student.appliedIds?.includes(id)) {
            const oldState = { ...student };
            
            const feedbackLines = student.feedback
              .split('\n\n')
              .filter((line: string) => !line.trim().startsWith(`${feedbackToDelete.grade}: ${feedbackToDelete.comment.trim()}`))
              .filter((line: string) => line.trim() !== '')
              .join('\n\n');

            const newAppliedIds = student.appliedIds.filter((appliedId: number) => appliedId !== id);
            
            const remainingDeduction = newAppliedIds.reduce((sum: number, appliedId: number) => {
              const feedback = feedbackItems.find(f => f.id === appliedId);
              return sum + (feedback?.grade || 0);
            }, 0);
            
            const newState = {
              ...student,
              grade: newAppliedIds.length === 0 ? "" : (maxPoints - remainingDeduction).toString(),
              feedback: feedbackLines || "",
              appliedIds: newAppliedIds,
            };

            onChangeTracked({
              type: 'feedback',
              studentName: student.name,
              oldValue: oldState,
              newValue: newState,
              timestamp: new Date().toISOString()
            });

            return newState;
          }
          return student;
        })
      );
    }

    setReusableIds(prev => [...prev, id]);
    setFeedbackItems(feedbackItems.filter(item => item.id !== id));
  };

  const getSortedFeedbackItems = () => {
    if (useManualOrder) {
      return feedbackItems;
    }
    
    return [...feedbackItems].sort((a, b) => {
      if (sortField === 'text') {
        const commentA = a.comment || '';
        const commentB = b.comment || '';
        return sortDirection === 'asc' 
          ? commentA.localeCompare(commentB)
          : commentB.localeCompare(commentA);
      }
      if (sortField === 'deduction') {
        return sortDirection === 'asc' 
          ? a.grade - b.grade
          : b.grade - a.grade;
      }
      const aApplied = appliedIds.includes(a.id) ? 1 : 0;
      const bApplied = appliedIds.includes(b.id) ? 1 : 0;
      return sortDirection === 'asc' 
        ? aApplied - bApplied
        : bApplied - aApplied;
    });
  };

  const handleSort = (field: SortField) => {
    setUseManualOrder(false);
    
    if (sortField === field) {
      setSortDirection((current: SortDirection) => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDragStart = () => {
    // No need to do anything here
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = feedbackItems.findIndex(item => item.id === active.id);
      const newIndex = feedbackItems.findIndex(item => item.id === over.id);
      
      const newItems = arrayMove(feedbackItems, oldIndex, newIndex);
      setFeedbackItems(newItems);
      
      const changeRecord: ChangeRecord = {
        type: 'feedback',
        timestamp: new Date().toISOString(),
        message: 'Feedback items reordered',
        oldValue: '',
        newValue: '',
        studentName: ''
      };
      onChangeTracked(changeRecord);
    }
  };

  const handleDragCancel = () => {
    console.log('Drag was cancelled');
  };

  const handleFeedbackSelect = (feedbackId: number) => {
    if (onFeedbackSelect) {
      onFeedbackSelect(feedbackId);
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(!!query.trim());
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const normalizedQuery = query.trim().toLowerCase();
      const results = feedbackItems.filter(item => 
        item.comment.toLowerCase().includes(normalizedQuery)
      );
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching feedback:', error);
      setSearchResults([]);
    }
  }, [feedbackItems]);

  const toggleSearchBar = () => {
    const newState = !isSearchBarVisible;
    setIsSearchBarVisible(newState);
    
    if (newState) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    } else {
      setSearchQuery('');
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchBarVisible(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
      
      if (e.key === 'Escape') {
        if (searchQuery && isSearching) {
          setSearchQuery('');
          setIsSearching(false);
          setSearchResults([]);
        } else if (isSearchBarVisible) {
          setIsSearchBarVisible(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching, searchQuery, isSearchBarVisible]);

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const displayItems = useMemo(() => {
    return isSearching ? searchResults : getSortedFeedbackItems();
  }, [isSearching, searchResults, getSortedFeedbackItems]);

  return (
    <div className="p-4 rounded-md h-[calc(100vh-280px)] flex flex-col mt-5" style={{ background: '#393E46', border: '1px solid #948979' }}>
      <div className="mb-2 relative flex items-center justify-end">
        <div className={`w-full transition-all duration-200 ease-out ${isSearchBarVisible ? 'visible' : 'invisible absolute'}`}>
          <div className={`w-full relative ${isSearchBarVisible ? fadeInClass : fadeOutClass}`}>
            <div className="relative flex items-center rounded pr-2" style={{ background: '#222831', border: '1px solid #948979' }}>
              <Search
                className="absolute left-2 top-1/2 transform -translate-y-1/2"
                style={{ color: '#948979' }}
                size={16}
              />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search feedback comments... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 pr-8 py-1 bg-transparent border-0 text-sm w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ color: '#DFD0B8' }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (!searchQuery) {
                      toggleSearchBar();
                    } else {
                      clearSearch();
                    }
                    e.preventDefault();
                  }
                }}
              />
              <button
                onClick={toggleSearchBar}
                className="ml-1 p-1 rounded-full"
                style={{ color: '#948979' }}
                aria-label="Close search"
              >
                <X size={14} />
              </button>
            </div>
            {isSearching && (
              <div className="mt-1 text-xs" style={{ color: '#948979' }}>
                Found {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={toggleSearchBar}
          className={`p-1.5 rounded-full transition-colors ${isSearchBarVisible ? 'hidden' : 'block'}`}
          style={{ color: '#948979' }}
          aria-label="Search feedback"
          title="Search feedback (Ctrl+F)"
        >
          <Search size={18} />
        </button>
      </div>
      
      <div className="overflow-y-auto flex-1 mb-2 scrollbar-thin scrollbar-thumb-[#444] scrollbar-track-[#222]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always
            },
          }}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <div className="rounded-md overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="border-b-0 sticky top-0 z-10" style={{ background: '#222831' }}>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="cursor-pointer py-2"
                    style={{ color: '#DFD0B8' }}
                    onClick={() => handleSort('text')}
                  >
                    Feedback
                    {sortField === 'text' && (
                      <span className="ml-2">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </TableHead>
                  <TableHead
                    className="w-[80px] cursor-pointer text-center py-2"
                    style={{ color: '#DFD0B8' }}
                    onClick={() => handleSort('deduction')}
                  >
                    Deduction
                    {sortField === 'deduction' && (
                      <span className="ml-2">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </TableHead>
                  <TableHead
                    className="w-[60px] cursor-pointer py-2"
                    style={{ color: '#DFD0B8' }}
                    onClick={() => handleSort('applied')}
                  >
                    Apply
                    {sortField === 'applied' && (
                      <span className="ml-2">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </TableHead>
                  <TableHead className="w-[80px] py-2" style={{ color: '#DFD0B8' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y-0">
                {displayItems.length > 0 ? (
                  <SortableContext
                    items={displayItems.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {displayItems.map((item) => (
                      <SortableItem
                        key={item.id}
                        id={item.id}
                        item={item}
                        editingId={editingId}
                        editingText={editingText}
                        editingDeduction={editingDeduction}
                        appliedIds={appliedIds}
                        selectedStudent={selectedStudent}
                        selectedStudents={selectedStudents}
                        onStartEdit={handleStartEdit}
                        onAcceptEdit={handleAcceptEdit}
                        onRejectEdit={handleRejectEdit}
                        onApplyFeedback={handleApplyFeedback}
                        onDeleteFeedback={handleDeleteFeedback}
                        setEditingText={setEditingText}
                        setEditingDeduction={setEditingDeduction}
                        onFeedbackSelect={handleFeedbackSelect}
                        selectedFeedbackId={selectedFeedbackId}
                      />
                    ))}
                  </SortableContext>
                ) : isSearching ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4" style={{ color: '#948979' }}>
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="text-lg mb-1">No results found</div>
                        <div className="text-sm">Try adjusting your search query</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4" style={{ color: '#948979' }}>
                      No feedback items available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DndContext>

        {isAddingFeedback ? (
          <div className="mt-2 p-3 rounded-md space-y-3 shadow-sm" style={{ background: '#222831', border: '1px solid #948979' }}>
            <Textarea
              value={newFeedback.comment}
              onChange={(e) => setNewFeedback({ ...newFeedback, comment: e.target.value })}
              placeholder="Enter feedback comment"
              aria-label="Feedback comment"
              className="min-h-[50px] resize-y text-sm"
              style={{ background: '#393E46', border: '1px solid #948979', color: '#DFD0B8' }}
            />
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={newFeedback.grade}
                onChange={(e) => setNewFeedback({ ...newFeedback, grade: Number(e.target.value) })}
                placeholder="Points"
                aria-label="Deduction points"
                className="w-[80px] text-center text-sm"
                style={{ background: '#393E46', border: '1px solid #948979', color: '#DFD0B8' }}
              />
              <div className="text-xs" style={{ color: '#948979' }}>Deduction points (0-20)</div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleAddFeedback}
                className="text-sm px-4 py-1"
                style={{ background: '#4CAF50', color: '#DFD0B8', border: '1px solid #4CAF50' }}
              >
                Add
              </Button>
              <Button
                onClick={() => setIsAddingFeedback(false)}
                className="text-sm px-4 py-1"
                style={{ background: '#f44336', color: '#DFD0B8', border: '1px solid #f44336' }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setIsAddingFeedback(true)}
            className="mt-2 w-full py-1.5 rounded-md shadow-sm"
            style={{ background: '#4CAF50', color: '#DFD0B8', border: '1px solid #4CAF50' }}
          >
            Add Feedback
          </Button>
        )}
      </div>
    </div>
  );
};

export default Feedback;
