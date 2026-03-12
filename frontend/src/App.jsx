import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Copy, AlertCircle, ArrowRight, Download } from 'lucide-react';
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

        {/* LaTeX Output */}
        <div className="flex-1 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-300">Optimized LaTeX</h3>
            <div className="flex gap-2">
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
        
        {/* Header */}
        <header className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-2 border border-blue-500/20">
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{textShadow: '0 4px 24px rgba(59,130,246,0.3)'}}>
            AI Resume <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Optimizer</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Upload your specialized resumes, paste the job description, and get perfectly tailored ATS-friendly LaTeX versions in seconds.
          </p>
        </header>

        {/* Main Content Area */}
        {!results ? (
          <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="space-y-8 relative z-10">
              
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
                  {isOptimizing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Analyzing & Optimizing...</span>
                    </>
                  ) : (
                    <>
                      <span>Optimize Both Resumes</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>

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
        )}

      </div>
    </div>
  );
}

export default App;
