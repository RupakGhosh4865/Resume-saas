import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Copy, AlertCircle, ArrowRight, Download, FileType, Mail, Clock, LayoutDashboard, Database, BrainCircuit, Sparkles, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function App() {
  const [genAiFile, setGenAiFile] = useState(null);
  const [backendFile, setBackendFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(null);
  const [view, setView] = useState('optimizer'); // 'optimizer' or 'dashboard'
  const [history, setHistory] = useState([]);
  const [thinkingStep, setThinkingStep] = useState(0);

  const thinkingSteps = [
    { icon: <FileText className="w-5 h-5" />, text: "Extracting original resume data...", color: "text-blue-400" },
    { icon: <Database className="w-5 h-5" />, text: "Analyzing Job Description requirements...", color: "text-purple-400" },
    { icon: <BrainCircuit className="w-5 h-5" />, text: "AI is mapping skills and expertise...", color: "text-emerald-400" },
    { icon: <Sparkles className="w-5 h-5" />, text: "Generating optimized LaTeX templates...", color: "text-yellow-400" },
    { icon: <Wand2 className="w-5 h-5" />, text: "Finalizing Cover Letter & Email...", color: "text-orange-400" },
  ];

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:8002/api/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  React.useEffect(() => {
    if (view === 'dashboard') {
      fetchHistory();
    }
  }, [view]);

  const handleFileChange = (setter) => (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setter(file);
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  const handleOptimize = async () => {
    if (!genAiFile || !backendFile || !jobDescription.trim()) {
      setError("Please provide both PDFs and a Job Description.");
      return;
    }

    setIsOptimizing(true);
    setError(null);
    setThinkingStep(0);

    // Animation interval
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev < thinkingSteps.length - 1 ? prev + 1 : prev));
    }, 2500);

    const formData = new FormData();
    formData.append('resume_genai', genAiFile);
    formData.append('resume_backend', backendFile);
    formData.append('job_description', jobDescription);

    try {
      const response = await fetch('http://localhost:8002/api/optimize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to optimize resumes");
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(interval);
      setIsOptimizing(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("LaTeX code copied!");
  };

  const downloadFile = (text, filename) => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element); // Required for FireFox
    element.click();
    document.body.removeChild(element);
  };

  const downloadPDF = async (latexCode, filename) => {
    setIsGeneratingPdf(filename);
    try {
      // Use our backend proxy to avoid CORS issues with latex.online
      const response = await fetch('http://localhost:8002/api/compile-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latex_code: latexCode
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "PDF compilation failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`PDF Generation Failed: ${err.message}. You can still download the .tex file and compile it on Overleaf.`);
      console.error(err);
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  const renderResultColumn = (title, data) => {
    if (!data) return null;

    return (
      <div className="flex-1 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">{title}</h2>
          <div className="flex flex-col items-end">
            <span className="text-sm text-slate-400">Match Score</span>
            <span className={cn("text-3xl font-black", getScoreColor(data.match_score))}>
              {data.match_score}%
            </span>
          </div>
        </div>

        {/* Keywords */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Keywords Added
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.added_keywords.map((kw, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  {kw}
                </span>
              ))}
              {data.added_keywords.length === 0 && <span className="text-xs text-slate-500 italic">None added</span>}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              Keywords Removed
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.removed_keywords.map((kw, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-full">
                  {kw}
                </span>
              ))}
              {data.removed_keywords.length === 0 && <span className="text-xs text-slate-500 italic">None removed</span>}
            </div>
          </div>
        </div>

        {/* ATS Tips */}
        <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400" />
            ATS Tips
          </h3>
          <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
            {data.ats_tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>

        {/* Project Suggestions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Suggested Projects</h3>
          <div className="grid gap-3">
            {data.project_suggestions.map((proj, i) => (
              <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                <h4 className="font-semibold text-blue-400 mb-1">{proj.title}</h4>
                <p className="text-sm text-slate-300 mb-2">{proj.description}</p>
                <div className="text-xs bg-blue-500/10 text-blue-300 p-2 rounded-lg border border-blue-500/20">
                  <span className="font-semibold block mb-1">Why this gets you selected:</span>
                  {proj.why_selected}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cover Letter & Email */}
        <div className="space-y-4">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Cover Letter
              </h3>
              <button 
                onClick={() => copyToClipboard(data.cover_letter)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
              {data.cover_letter}
            </p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                Recruitment Email
              </h3>
              <button 
                onClick={() => copyToClipboard(data.application_email)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
              {data.application_email}
            </p>
          </div>
        </div>

        {/* LaTeX Output */}
        <div className="flex-1 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-300">Optimized LaTeX</h3>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => downloadPDF(data.optimized_resume_latex, `${title.replace(/\s+/g, '_')}_Optimized.pdf`)}
                disabled={isGeneratingPdf === `${title.replace(/\s+/g, '_')}_Optimized.pdf`}
                className="flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors border border-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {isGeneratingPdf === `${title.replace(/\s+/g, '_')}_Optimized.pdf` ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <FileType className="w-3 h-3" />
                )}
                Download PDF
              </button>
              <button 
                onClick={() => downloadFile(data.optimized_resume_latex, `${title.replace(/\s+/g, '_')}_Optimized.tex`)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
              >
                <Download className="w-3 h-3" />
                Download .tex
              </button>
              <button 
                onClick={() => copyToClipboard(data.optimized_resume_latex)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
              >
                <Copy className="w-3 h-3" />
                Copy Code
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={data.optimized_resume_latex}
            className="flex-1 w-full bg-slate-950 text-slate-300 text-xs font-mono p-4 rounded-xl border border-slate-800 focus:outline-none resize-none"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation */}
        <div className="flex justify-center gap-4 mb-4">
          <button 
            onClick={() => setView('optimizer')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all border",
              view === 'optimizer' 
                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30" 
                : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Optimizer
          </button>
          <button 
            onClick={() => setView('dashboard')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all border",
              view === 'dashboard' 
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30" 
                : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* Header */}
        <header className="text-center space-y-4 py-4">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-2 border border-blue-500/20">
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{textShadow: '0 4px 24px rgba(59,130,246,0.3)'}}>
            AI Resume <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Optimizer</span>
          </h1>
        </header>

        {view === 'dashboard' ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-400" />
              Optimization History
            </h2>
            {history.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-20 text-center">
                <Database className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 italic">No historical records found. Start optimizing to see your history!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {history.map((item) => (
                  <div key={item.id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/30 transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl rounded-full" />
                    <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">Saved Optimization</span>
                        </div>
                        <p className="text-sm text-slate-300 font-medium line-clamp-2 italic">"{item.job_description}"</p>
                        <div className="flex gap-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase">Gen AI Match</span>
                            <span className={cn("text-lg font-bold", getScoreColor(item.match_score_genai))}>{item.match_score_genai}%</span>
                          </div>
                          <div className="flex flex-col border-l border-slate-800 pl-4">
                            <span className="text-[10px] text-slate-500 uppercase">Backend Match</span>
                            <span className={cn("text-lg font-bold", getScoreColor(item.match_score_backend))}>{item.match_score_backend}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <button 
                          onClick={() => {
                            setResults(item.data);
                            setView('optimizer');
                          }}
                          className="px-6 py-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-500 hover:text-white transition-all font-semibold text-sm"
                        >
                          View Optimization
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Main Content Area */
          !results ? (
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
              {/* Decorative background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
              
              <div className="space-y-8 relative z-10">
                
                {isOptimizing ? (
                  <div className="py-12 space-y-8 animate-in fade-in duration-500">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                        <BrainCircuit className="w-10 h-10 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                          AI Thinking Process
                        </h3>
                        <p className="text-slate-400 text-sm">Hold tight, we're optimizing your career path...</p>
                      </div>
                    </div>

                    <div className="max-w-md mx-auto space-y-4">
                      {thinkingSteps.map((step, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500",
                            thinkingStep === i 
                              ? "bg-slate-800 border-slate-600 shadow-lg scale-105" 
                              : thinkingStep > i 
                                ? "bg-slate-900/30 border-slate-800 opacity-50" 
                                : "bg-slate-900/10 border-transparent opacity-20"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg bg-slate-950",
                            thinkingStep === i ? step.color : "text-slate-600"
                          )}>
                            {thinkingStep > i ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : step.icon}
                          </div>
                          <span className={cn(
                            "text-sm font-medium",
                            thinkingStep === i ? "text-slate-200" : "text-slate-500"
                          )}>
                            {step.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* File Upload 1 */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300 block">Gen AI Resume (PDF)</label>
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200",
                          genAiFile ? "border-blue-500 bg-blue-500/5" : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 bg-slate-900",
                        )}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                            {genAiFile ? (
                              <>
                                <CheckCircle className="w-8 h-8 text-blue-500 mb-2" />
                                <p className="text-sm text-slate-300 font-medium truncate max-w-full">{genAiFile.name}</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-slate-500 mb-3" />
                                <p className="text-sm text-slate-400"><span className="font-semibold text-blue-400">Click to upload</span> or drag and drop</p>
                              </>
                            )}
                          </div>
                          <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange(setGenAiFile)} />
                        </label>
                      </div>

                      {/* File Upload 2 */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300 block">Backend Developer Resume (PDF)</label>
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200",
                          backendFile ? "border-purple-500 bg-purple-500/5" : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 bg-slate-900",
                        )}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                            {backendFile ? (
                              <>
                                <CheckCircle className="w-8 h-8 text-purple-500 mb-2" />
                                <p className="text-sm text-slate-300 font-medium truncate max-w-full">{backendFile.name}</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-slate-500 mb-3" />
                                <p className="text-sm text-slate-400"><span className="font-semibold text-purple-400">Click to upload</span> or drag and drop</p>
                              </>
                            )}
                          </div>
                          <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange(setBackendFile)} />
                        </label>
                      </div>
                    </div>

                    {/* Job Description */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 flex justify-between">
                        <span>Job Description / Vacancy</span>
                        <span className="text-slate-500 font-normal">{jobDescription.length} chars</span>
                      </label>
                      <textarea 
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here... Our AI will analyze exactly what the employer is looking for."
                        className="w-full h-48 bg-slate-950/50 border border-slate-700 rounded-2xl p-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-y"
                      />
                    </div>

                    {error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p>{error}</p>
                      </div>
                    )}

                    {/* Action Button */}
                    <button 
                      onClick={handleOptimize}
                      disabled={isOptimizing}
                      className="w-full relative group overflow-hidden rounded-2xl p-px font-semibold text-white shadow-lg transition-all"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80 group-hover:opacity-100 transition-opacity"></span>
                      <div className="relative flex items-center justify-center gap-2 bg-slate-900 px-8 py-4 rounded-[15px] transition-all group-hover:bg-opacity-0">
                        <>
                          <span>Optimize Both Resumes</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      </div>
                    </button>
                  </>
                )}

              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Optimization Results</h2>
                <button 
                  onClick={() => setResults(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-medium border border-slate-700"
                >
                  Start Over
                </button>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-6">
                {renderResultColumn("Gen AI Resume", results.resume_genai)}
                {renderResultColumn("Backend Developer Resume", results.resume_backend)}
              </div>
            </div>
          )
        )}

      </div>
    </div>
  );
}

export default App;
