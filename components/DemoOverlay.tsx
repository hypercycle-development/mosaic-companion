
import React, { useEffect, useState, useRef } from 'react';
import { X, Mic, Brain, Send, Mail, MessageSquare, CheckCircle, Search, Shield, Server, Activity, ArrowRight, Database, Users } from 'lucide-react';

interface DemoOverlayProps {
  onClose: () => void;
}

type Speaker = 'USER' | 'MOSAIC' | 'NARRATOR';

interface ScriptStep {
  speaker: Speaker;
  text: string;
  duration: number; // ms to display
  action?: 'SHOW_EMAIL' | 'SHOW_REPLY' | 'SHOW_BRAINSTORM' | 'SHOW_REPORT' | 'SHOW_CTA';
}

const SCRIPT: ScriptStep[] = [
  // Intro
  { speaker: 'NARRATOR', text: "Let's look at a few examples of how Mosaic works. Initially, it acts as a tool that helps humans connect to the Internet of AI.", duration: 6000 },
  { speaker: 'NARRATOR', text: "It starts with simple commands. For example, the user might type:", duration: 3000 },
  
  // Scenario 1: Email/Text Command
  { speaker: 'USER', text: "Hey Mosaic check all my emails and messages and see if there is anything from Bill Gates, and show it to me here.", duration: 6000 },
  { speaker: 'MOSAIC', text: "Accessing 24 integrated applications. Searching for 'Bill Gates' across all channels...", duration: 2500 },
  { speaker: 'MOSAIC', text: "I found 3 relevant threads across Gmail, Outlook, and Signal.", duration: 3000, action: 'SHOW_EMAIL' },
  { speaker: 'USER', text: "Reply on the email in details about the findings we have done yesterday about the research but then reply in the text and the SignalApp and tell him: 'Yo Billy, response was sent to you by email'", duration: 9000 },
  { speaker: 'MOSAIC', text: "Drafting detailed email response based on 'Research_Findings_Yesterday.pdf'...", duration: 2500 },
  { speaker: 'MOSAIC', text: "Email sent. Sending Signal message: 'Yo Billy, response was sent to you by email'.", duration: 3000, action: 'SHOW_REPLY' },

  // Scenario 2: Voice/Brainstorming
  { speaker: 'NARRATOR', text: "Then, let's look at a more advanced example. You can press the [Talk to AI] button and speak naturally.", duration: 5000 },
  { speaker: 'USER', text: "Hey Mosaic, I want to brainstorm with you on that research we were working on yesterday and try to come up with some attack vector and how to prevent them. Use Gemini, Grok, Claude, ChatGPT but keep updating the local data as you learn more about these topics.", duration: 11000 },
  { speaker: 'MOSAIC', text: "Acknowledged. Activating multi-LLM swarm (Gemini, Grok, Claude, ChatGPT).", duration: 3000, action: 'SHOW_BRAINSTORM' },
  { speaker: 'MOSAIC', text: "I am syncing their outputs with your local neural index. I have identified 4 potential attack vectors based on the combined logic.", duration: 5000 },
  { speaker: 'USER', text: "Okay generate a report on these new findings and share it with my direct reports, excluding Jay, Billy and Trump.", duration: 6000 },
  { speaker: 'USER', text: "Notify me when they respond and make sure I confirm to you within 2 hours that I have received the notification. If they send you long response, research it, analyze it and give me summary of it once you are finished.", duration: 9000 },
  { speaker: 'MOSAIC', text: "Report generated. Recipients filtered (Excluding: Jay, Billy, Trump).", duration: 3000, action: 'SHOW_REPORT' },
  { speaker: 'MOSAIC', text: "Distribution complete. I have set a 2-hour confirmation timer and enabled auto-summarization for incoming responses.", duration: 5000 },

  // Outro
  { speaker: 'NARRATOR', text: "MOSAIC. Your AI Companion that belongs to you.", duration: 3500, action: 'SHOW_CTA' },
  { speaker: 'NARRATOR', text: "Start now by owning all your data as the MOSAIC community continues building this safe and secure tool for everyone.", duration: 6000 },
  { speaker: 'NARRATOR', text: "Click here to download and install it on all your devices for only $1.99 per year.", duration: 4500 },
  { speaker: 'NARRATOR', text: "Own your brain.", duration: 3000 },
];

export const DemoOverlay: React.FC<DemoOverlayProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [visualState, setVisualState] = useState<'IDLE' | 'SHOW_EMAIL' | 'SHOW_REPLY' | 'SHOW_BRAINSTORM' | 'SHOW_REPORT' | 'SHOW_CTA'>('IDLE');
  
  // Progress logic
  useEffect(() => {
    if (currentStep >= SCRIPT.length) return;

    const step = SCRIPT[currentStep];
    if (step.action) setVisualState(step.action);

    const timer = setTimeout(() => {
      if (currentStep < SCRIPT.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    }, step.duration);

    return () => clearTimeout(timer);
  }, [currentStep]);

  const step = SCRIPT[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-xl flex flex-col font-sans text-white animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-sm tracking-widest text-gray-400">DEMO SEQUENCE_ACTIVE</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <X size={24} className="text-gray-400" />
        </button>
      </div>

      {/* Main Stage */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-8">
        
        {/* Dynamic Visual Content */}
        <div className="w-full max-w-4xl flex-1 flex items-center justify-center mb-8 relative">
            
            {visualState === 'IDLE' && (
                <div className="text-center opacity-50">
                    <Activity size={64} className="mx-auto mb-4 text-indigo-500 animate-pulse" />
                    <h2 className="text-2xl font-light">Mosaic Neural Engine</h2>
                    <p className="text-sm text-gray-500 mt-2 font-mono">STANDBY MODE</p>
                </div>
            )}

            {visualState === 'SHOW_EMAIL' && (
                <div className="w-full bg-gray-900 rounded-xl border border-gray-800 p-6 animate-in zoom-in duration-300">
                    <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2"><Search className="text-indigo-400"/> Search Results: "Bill Gates"</h3>
                        <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded">3 Found</span>
                    </div>
                    <div className="space-y-3">
                        <div className="p-4 bg-gray-800/50 rounded-lg flex items-center gap-4 border border-gray-700">
                            <Mail className="text-blue-400" />
                            <div>
                                <div className="font-bold text-sm">Bill Gates (Outlook)</div>
                                <div className="text-xs text-gray-400">Subject: Research coordination regarding...</div>
                            </div>
                        </div>
                         <div className="p-4 bg-gray-800/50 rounded-lg flex items-center gap-4 border border-gray-700">
                            <MessageSquare className="text-blue-400" />
                            <div>
                                <div className="font-bold text-sm">Billy G (Signal)</div>
                                <div className="text-xs text-gray-400">Are we still on for the summit?</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {visualState === 'SHOW_REPLY' && (
                <div className="w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 p-6 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-2 mb-4 text-green-400 font-mono text-sm">
                        <CheckCircle size={16} /> Action Executed
                    </div>
                    <div className="bg-gray-800 p-3 rounded text-sm text-gray-300 font-mono mb-2">
                        &gt; Email Sent to: Bill Gates<br/>
                        &gt; Attachment: Research_Findings.pdf
                    </div>
                     <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded text-sm text-blue-200 font-mono">
                        &gt; Signal Sent to: Billy G<br/>
                        &gt; "Yo Billy, response was sent to you by email"
                    </div>
                </div>
            )}

             {visualState === 'SHOW_BRAINSTORM' && (
                <div className="w-full bg-gray-900 rounded-xl border border-gray-800 p-6 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                             <Brain className="text-purple-500" size={24} />
                             <span className="font-bold text-xl">Swarm Intelligence Active</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        {['Gemini', 'Grok', 'Claude', 'ChatGPT'].map((ai, i) => (
                            <div key={ai} className="bg-gray-800/50 p-3 rounded border border-gray-700 text-center animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                                <div className="w-2 h-2 rounded-full bg-indigo-500 mx-auto mb-2" />
                                <span className="text-xs font-mono text-gray-300">{ai}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-black/40 p-4 rounded border border-indigo-500/30 flex items-center justify-center gap-4">
                        <Database className="text-indigo-400" />
                        <div className="flex-1">
                             <div className="text-xs text-indigo-300 mb-1">UPDATING LOCAL NEURAL INDEX</div>
                             <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-indigo-500 animate-progress" style={{ width: '65%' }} />
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {visualState === 'SHOW_REPORT' && (
                <div className="w-full max-w-lg bg-gray-900 rounded-xl border border-gray-800 p-6 animate-in zoom-in duration-300">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-500/20 rounded text-green-400"><CheckCircle size={20} /></div>
                        <div>
                            <h3 className="font-bold">Report Generated</h3>
                            <p className="text-xs text-gray-500">Auto-Distribution Protocol Initiated</p>
                        </div>
                    </div>

                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm p-2 bg-gray-800 rounded">
                            <span className="text-gray-400">Recipient Group</span>
                            <span className="text-white">Direct Reports</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-red-900/20 border border-red-900/30 rounded">
                            <span className="text-red-400">Excluded Filters</span>
                            <span className="text-red-300 font-mono text-xs">['Jay', 'Billy', 'Trump']</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-blue-900/20 border border-blue-900/30 rounded">
                            <span className="text-blue-400">Logic</span>
                            <span className="text-blue-300 font-mono text-xs">Notify + 2hr Confirm + Auto-Summarize</span>
                        </div>
                    </div>
                </div>
            )}

            {visualState === 'SHOW_CTA' && (
                <div className="text-center animate-in zoom-in duration-700">
                     <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 mb-6">
                        MOSAIC
                    </h1>
                    <p className="text-xl text-gray-400 mb-8 max-w-xl mx-auto">
                        Own your brain.
                    </p>
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:shadow-[0_0_50px_rgba(79,70,229,0.6)] transition-all transform hover:scale-105">
                        Download Now • $1.99/yr
                    </button>
                    <div className="mt-8 flex justify-center gap-4 text-gray-600">
                        <Shield size={24} />
                        <Server size={24} />
                        <Brain size={24} />
                    </div>
                </div>
            )}
        </div>


        {/* Transcript / Audio Visualizer Area */}
        <div className="w-full max-w-3xl min-h-[140px] bg-black/60 backdrop-blur-xl rounded-2xl border border-gray-800/50 p-6 flex items-start gap-4 transition-all shadow-2xl">
            
            {/* Avatar & Audio Visualizer */}
            <div className="flex flex-col items-center gap-2">
                <div className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center border-2 transition-colors duration-300 shadow-lg
                    ${step.speaker === 'USER' ? 'border-gray-400 bg-gray-800' : ''}
                    ${step.speaker === 'MOSAIC' ? 'border-indigo-500 bg-indigo-900/20' : ''}
                    ${step.speaker === 'NARRATOR' ? 'border-transparent bg-transparent' : ''}
                `}>
                    {step.speaker === 'USER' && <span className="font-bold text-gray-300 text-xs">YOU</span>}
                    {step.speaker === 'MOSAIC' && <SparklesIcon className="text-indigo-400" />}
                    {step.speaker === 'NARRATOR' && <Mic className="text-gray-500" />}
                </div>
                
                {/* Simulated Waveform */}
                <div className="flex gap-0.5 items-end h-4">
                    {[1,2,3,4,5].map(i => (
                        <div key={i} className={`w-1 bg-current rounded-full animate-bounce
                            ${step.speaker === 'USER' ? 'text-gray-500' : ''}
                            ${step.speaker === 'MOSAIC' ? 'text-indigo-500' : ''}
                            ${step.speaker === 'NARRATOR' ? 'text-green-500' : ''}
                        `} style={{ height: `${Math.random() * 100}%`, animationDuration: `${0.5 + Math.random()}s` }} />
                    ))}
                </div>
            </div>

            <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold tracking-wider uppercase
                         ${step.speaker === 'USER' ? 'text-gray-400' : ''}
                         ${step.speaker === 'MOSAIC' ? 'text-indigo-400' : ''}
                         ${step.speaker === 'NARRATOR' ? 'text-green-500' : ''}
                    `}>
                        {step.speaker === 'MOSAIC' ? 'MOSAIC AI' : step.speaker}
                    </span>
                </div>
                <p className="text-lg md:text-xl font-light leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300 key={currentStep}">
                    "{step.text}"
                </p>
            </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-3xl mt-6 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
                className="h-full bg-indigo-600 transition-all duration-300 ease-linear"
                style={{ width: `${((currentStep + 1) / SCRIPT.length) * 100}%` }}
            />
        </div>

      </div>
    </div>
  );
};

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
);
