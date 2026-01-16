import React, { useState, useEffect, useRef } from 'react';
import {
    Home,
    Settings,
    MessageSquare,
    Plus,
    X,
    Search,
    ArrowRight,
    Command,
    Globe,
    Sparkles,
    Bot,
    Clock,
    Star,
    RotateCw,
    ArrowLeft,
    ArrowRight as ArrowRightIcon,
    PanelLeft,
    Trash2
} from 'lucide-react';
import {
    INTERNAL_HOME_URL,
    INTERNAL_SETTINGS_URL,
    INTERNAL_CHAT_URL,
    Tab
} from '../types/types';

export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    category: 'Navigation' | 'Tabs' | 'Actions' | 'AI';
    action: () => void;
    keywords?: string[];
    disabled?: boolean;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    tabs: Tab[];
    activeTabId: string;
    onNavigate: (url: string) => void;
    onSwitchTab: (id: string) => void;
    onNewTab: () => void;
    onNewChatTab: () => void;
    onCloseTab?: (id: string, e?: React.MouseEvent) => void;
    onToggleSidebar: () => void;
    onRefresh: () => void;
    onBack: () => void;
    onForward: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
    onSearchInNewTab?: (query: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    tabs,
    activeTabId,
    onNavigate,
    onSwitchTab,
    onNewTab,
    onNewChatTab,
    onCloseTab,
    onToggleSidebar,
    onRefresh,
    onBack,
    onForward,
    canGoBack,
    canGoForward,
    onSearchInNewTab
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Build commands list
    const allCommands: CommandItem[] = [
        // Navigation
        {
            id: 'home',
            label: 'Go to Home',
            description: 'Navigate to home page',
            icon: <Home size={18} />,
            category: 'Navigation',
            action: () => {
                onNavigate(INTERNAL_HOME_URL);
                onClose();
            },
            keywords: ['home', 'start', 'landing']
        },
        {
            id: 'settings',
            label: 'Open Settings',
            description: 'Configure browser settings',
            icon: <Settings size={18} />,
            category: 'Navigation',
            action: () => {
                onNavigate(INTERNAL_SETTINGS_URL);
                onClose();
            },
            keywords: ['settings', 'config', 'preferences', 'options']
        },
        {
            id: 'chat',
            label: 'Open AI Chat',
            description: 'Start chatting with AI agents',
            icon: <Bot size={18} />,
            category: 'Navigation',
            action: () => {
                onNavigate(INTERNAL_CHAT_URL);
                onClose();
            },
            keywords: ['chat', 'ai', 'assistant', 'bot']
        },
        {
            id: 'sidebar',
            label: 'Toggle Sidebar',
            description: 'Show or hide the sidebar',
            icon: <PanelLeft size={18} />,
            category: 'Navigation',
            action: () => {
                onToggleSidebar();
                onClose();
            },
            keywords: ['sidebar', 'panel', 'menu']
        },
        // Tabs
        {
            id: 'new-tab',
            label: 'New Tab',
            description: 'Open a new browser tab',
            icon: <Plus size={18} />,
            category: 'Tabs',
            action: () => {
                onNewTab();
                onClose();
            },
            keywords: ['new', 'tab', 'open']
        },
        {
            id: 'new-chat-tab',
            label: 'New Chat Tab',
            description: 'Open a new AI chat tab',
            icon: <MessageSquare size={18} />,
            category: 'Tabs',
            action: () => {
                onNewChatTab();
                onClose();
            },
            keywords: ['new', 'chat', 'ai', 'tab']
        },
        ...tabs.map((tab, index) => ({
            id: `tab-${tab.id}`,
            label: tab.title || 'Untitled Tab',
            description: tab.history.present,
            icon: tab.favicon ? (
                <img src={tab.favicon} alt='' className='w-4 h-4' />
            ) : (
                <Globe size={18} />
            ),
            category: 'Tabs' as const,
            action: () => {
                onSwitchTab(tab.id);
                onClose();
            },
            keywords: [tab.title, tab.history.present, 'tab', 'switch']
        })),
        // Actions
        {
            id: 'refresh',
            label: 'Refresh Page',
            description: 'Reload the current page',
            icon: <RotateCw size={18} />,
            category: 'Actions',
            action: () => {
                onRefresh();
                onClose();
            },
            keywords: ['refresh', 'reload', 'update']
        },
        {
            id: 'back',
            label: 'Go Back',
            description: 'Navigate to previous page',
            icon: <ArrowLeft size={18} />,
            category: 'Actions',
            action: () => {
                if (canGoBack) {
                    onBack();
                    onClose();
                }
            },
            keywords: ['back', 'previous', 'history'],
            disabled: !canGoBack
        },
        {
            id: 'forward',
            label: 'Go Forward',
            description: 'Navigate to next page',
            icon: <ArrowRightIcon size={18} />,
            category: 'Actions',
            action: () => {
                if (canGoForward) {
                    onForward();
                    onClose();
                }
            },
            keywords: ['forward', 'next', 'history'],
            disabled: !canGoForward
        }
    ];

    // Filter commands based on search query
    const filteredCommands = allCommands.filter((cmd) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            cmd.label.toLowerCase().includes(query) ||
            cmd.description?.toLowerCase().includes(query) ||
            cmd.keywords?.some((kw) => kw.toLowerCase().includes(query)) ||
            cmd.category.toLowerCase().includes(query)
        );
    });

    // Add search action if query doesn't match any commands and has content
    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasMatches = filteredCommands.length > 0;
    const showSearchAction = hasSearchQuery && !hasMatches && onSearchInNewTab;

    // Group commands by category
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) {
            acc[cmd.category] = [];
        }
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, CommandItem[]>);

    // Flatten for selection
    const flatCommands = filteredCommands;

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setSearchQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent Cmd+K from closing when palette is open
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const maxIndex =
                    flatCommands.length + (showSearchAction ? 1 : 0) - 1;
                setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const maxIndex =
                    flatCommands.length + (showSearchAction ? 1 : 0) - 1;
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                // If search action is shown and selected, trigger search
                if (showSearchAction && selectedIndex === flatCommands.length) {
                    if (onSearchInNewTab) {
                        onSearchInNewTab(searchQuery.trim());
                    }
                    onClose();
                    return;
                }
                // Otherwise execute selected command
                if (flatCommands[selectedIndex]) {
                    flatCommands[selectedIndex].action();
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [
        isOpen,
        flatCommands,
        selectedIndex,
        onClose,
        showSearchAction,
        searchQuery,
        onSearchInNewTab
    ]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && flatCommands[selectedIndex]) {
            const selectedElement = listRef.current.children[
                selectedIndex
            ] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedIndex, flatCommands]);

    if (!isOpen) return null;

    return (
        <div
            className='fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
            onClick={onClose}
        >
            <div
                className='w-full max-w-2xl mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200'
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className='flex items-center gap-3 px-4 py-4 border-b border-gray-800'>
                    <Search size={20} className='text-gray-500 shrink-0' />
                    <input
                        ref={inputRef}
                        type='text'
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder='Type a command or search...'
                        className='flex-1 bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 text-lg'
                    />
                    <div className='flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 font-mono'>
                        <Command size={12} />
                        <span>K</span>
                    </div>
                </div>

                {/* Commands List */}
                <div
                    ref={listRef}
                    className='max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent'
                >
                    {Object.keys(groupedCommands).length === 0 &&
                    !showSearchAction ? (
                        <div className='px-4 py-12 text-center'>
                            <div className='w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4'>
                                <Search size={24} className='text-gray-600' />
                            </div>
                            <p className='text-gray-400'>No commands found</p>
                            <p className='text-sm text-gray-600 mt-1'>
                                Try a different search term
                            </p>
                        </div>
                    ) : (
                        <>
                            {Object.entries(groupedCommands).map(
                                ([category, commands]) => (
                                    <div key={category} className='py-2'>
                                        <div className='px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider'>
                                            {category}
                                        </div>
                                        {commands.map((cmd, idx) => {
                                            const flatIndex =
                                                flatCommands.indexOf(cmd);
                                            const isSelected =
                                                flatIndex === selectedIndex;
                                            const isActive =
                                                cmd.id.startsWith('tab-') &&
                                                cmd.id === `tab-${activeTabId}`;

                                            return (
                                                <button
                                                    key={cmd.id}
                                                    onClick={cmd.action}
                                                    disabled={
                                                        'disabled' in cmd &&
                                                        cmd.disabled
                                                    }
                                                    className={`
                          w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                          ${
                              isSelected
                                  ? 'bg-indigo-900/30 text-indigo-400'
                                  : 'text-gray-300 hover:bg-gray-800'
                          }
                          ${
                              'disabled' in cmd && cmd.disabled
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                          }
                          ${isActive ? 'border-l-2 border-indigo-500' : ''}
                        `}
                                                >
                                                    <div
                                                        className={`shrink-0 ${
                                                            isSelected
                                                                ? 'text-indigo-400'
                                                                : 'text-gray-500'
                                                        }`}
                                                    >
                                                        {cmd.icon}
                                                    </div>
                                                    <div className='flex-1 min-w-0'>
                                                        <div className='font-medium flex items-center gap-2'>
                                                            {cmd.label}
                                                            {isActive && (
                                                                <span className='text-xs px-2 py-0.5 bg-indigo-900/30 text-indigo-400 rounded'>
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        {cmd.description && (
                                                            <div className='text-xs text-gray-500 truncate mt-0.5'>
                                                                {
                                                                    cmd.description
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {/* Search Action - Show when query doesn't match commands */}
                            {showSearchAction && (
                                <div className='py-2 border-t border-gray-800'>
                                    <div className='px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider'>
                                        Search
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (onSearchInNewTab) {
                                                onSearchInNewTab(
                                                    searchQuery.trim()
                                                );
                                            }
                                            onClose();
                                        }}
                                        className={`
                                        w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                        ${
                                            selectedIndex ===
                                            flatCommands.length
                                                ? 'bg-indigo-900/30 text-indigo-400'
                                                : 'text-gray-300 hover:bg-gray-800'
                                        }
                                    `}
                                    >
                                        <div
                                            className={`shrink-0 ${
                                                selectedIndex ===
                                                flatCommands.length
                                                    ? 'text-indigo-400'
                                                    : 'text-gray-500'
                                            }`}
                                        >
                                            <Search size={18} />
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <div className='font-medium'>
                                                Search for "{searchQuery.trim()}
                                                "
                                            </div>
                                            <div className='text-xs text-gray-500 truncate mt-0.5'>
                                                Open in new tab
                                            </div>
                                        </div>
                                        <div className='shrink-0 flex items-center gap-1 text-xs text-gray-500 font-mono'>
                                            <kbd className='px-1.5 py-0.5 bg-gray-800 rounded text-gray-400'>
                                                Enter
                                            </kbd>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className='px-4 py-3 border-t border-gray-800 bg-gray-950/50 flex items-center justify-between text-xs text-gray-500'>
                    <div className='flex items-center gap-4'>
                        <div className='flex items-center gap-1'>
                            <ArrowRight size={12} />
                            <span>Select</span>
                        </div>
                        <div className='flex items-center gap-1'>
                            <ArrowRight size={12} className='rotate-90' />
                            <span>Navigate</span>
                        </div>
                    </div>
                    <div className='flex items-center gap-1'>
                        <kbd className='px-1.5 py-0.5 bg-gray-800 rounded'>
                            Esc
                        </kbd>
                        <span>to close</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
