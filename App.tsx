
import React, { useState, useRef, useEffect } from 'react';
import { Viewer3D, Viewer3DHandle } from './components/Keychain3D';
import { analyzeDesign } from './services/geminiService';
import { processLogo } from './utils/imageProcessor';
import { saveDesignToDatabase, getAllDesigns, SavedDesign } from './services/storageService';
import { LogoConfig, AnalysisResult } from './types';
import { 
  Upload, 
  Move, 
  Maximize, 
  RotateCw, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck, 
  Layers,
  Sparkles,
  Loader2,
  Palette,
  XCircle,
  Package,
  ShoppingCart,
  Database,
  ExternalLink,
  Download,
  Lock
} from 'lucide-react';

// PRODUCTION CONFIG
// In Vercel, set these Environment Variables:
// REACT_APP_SHOPIFY_DOMAIN
// REACT_APP_PRODUCT_VARIANT_ID
const SHOPIFY_DOMAIN = process.env.REACT_APP_SHOPIFY_DOMAIN || "your-shop.myshopify.com"; 
const PRODUCT_VARIANT_ID = process.env.REACT_APP_PRODUCT_VARIANT_ID || "123456789"; 

const App: React.FC = () => {
  // Check for Admin Mode (?admin=true)
  const queryParams = new URLSearchParams(window.location.search);
  const isAdmin = queryParams.get('admin') === 'true';

  // State
  const [logoConfig, setLogoConfig] = useState<LogoConfig>({
    url: null,
    x: 0,
    y: 0,
    scale: 30, 
    rotation: 0,
  });
  
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [redirectStatus, setRedirectStatus] = useState<'idle' | 'saving' | 'redirecting'>('idle');
  
  // Admin State
  const [adminDesigns, setAdminDesigns] = useState<SavedDesign[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Refs
  const viewerRef = useRef<Viewer3DHandle>(null);

  useEffect(() => {
    if (isAdmin) {
      setLoadingAdmin(true);
      getAllDesigns().then(data => {
        setAdminDesigns(data);
        setLoadingAdmin(false);
      });
    }
  }, [isAdmin]);

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFileError("File too large. Max 5MB.");
      return;
    }

    setFileError(null);
    setActiveStep(2); 
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawResult = event.target?.result as string;
      
      try {
        setProcessingStatus("Removing background & Centering...");
        const processedImage = await processLogo(rawResult);
        
        setLogoConfig({ 
            url: processedImage,
            x: 0,
            y: 0,
            scale: 30, 
            rotation: 0
        });

        setProcessingStatus("AI optimizing scale & printability...");
        const aiResult = await analyzeDesign(processedImage);
        setAnalysis(aiResult);
        
        if (aiResult.isPrintable) {
          setLogoConfig(prev => ({
            ...prev,
            scale: aiResult.recommendedScale || 36 
          }));
          setActiveStep(3); 
        }
        
      } catch (err) {
        console.error(err);
        setFileError("System Error: Could not verify design.");
        setActiveStep(1);
      } finally {
        setProcessingStatus("");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProceedToCheckout = () => {
    setActiveStep(4);
  };

  const resetUpload = () => {
    setLogoConfig(prev => ({ ...prev, url: null }));
    setAnalysis(null);
    setActiveStep(1);
    setRedirectStatus('idle');
  };

  const handleShopifyCheckout = async () => {
      if (!analysis || !logoConfig) return;
      
      setRedirectStatus('saving');

      // 1. Save to Supabase
      const designId = await saveDesignToDatabase(logoConfig, analysis);

      setRedirectStatus('redirecting');
      
      // 2. Redirect to Shopify
      const baseUrl = `https://${SHOPIFY_DOMAIN}/cart/${PRODUCT_VARIANT_ID}:1`;
      const params = new URLSearchParams();
      
      params.append('attributes[Design ID]', designId);
      params.append('attributes[Colors]', analysis.suggestedColors.join(', '));
      params.append('attributes[Scale]', `${logoConfig.scale}mm`);
      
      const finalUrl = `${baseUrl}?${params.toString()}`;
      
      window.location.href = finalUrl;
  };

  // --- ADMIN DASHBOARD RENDER ---
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 font-sans">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-6 h-6 text-blue-600" /> Merchant Dashboard
            </h1>
            <a href="/" className="text-sm text-blue-600 hover:underline">Back to App</a>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between">
              <span className="font-semibold text-slate-700">Recent Designs</span>
              <button onClick={() => window.location.reload()} className="text-xs text-blue-600 font-bold">Refresh</button>
            </div>
            
            {loadingAdmin ? (
              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Preview</th>
                    <th className="px-6 py-3">Details</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminDesigns.map(design => (
                    <tr key={design.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">{design.id}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(design.created_at || Date.now()).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 bg-slate-100 rounded border border-slate-200 p-1">
                          <img src={design.image_url} alt="Design" className="w-full h-full object-contain" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-xs text-slate-500">
                          <p>Scale: <span className="font-bold">{design.config.scale}mm</span></p>
                          <p>Colors: {design.analysis.suggestedColors.length}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <a 
                            href={design.image_url} 
                            download={`design-${design.id}.png`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                         >
                            <Download className="w-4 h-4" /> PNG
                         </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight text-slate-900">
                PrintForge <span className="text-blue-600">Studio</span>
              </h1>
            </div>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-500">
             <div className={`flex items-center gap-2 ${activeStep >= 1 ? 'text-slate-900' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${activeStep >= 1 ? 'bg-slate-900 text-white' : 'bg-white border-slate-300'}`}>1</span>
                Upload & Verify
             </div>
             <div className="w-12 h-px bg-slate-200 my-auto"></div>
             <div className={`flex items-center gap-2 ${activeStep >= 3 ? 'text-slate-900' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${activeStep >= 3 ? 'bg-slate-900 text-white' : 'bg-white border-slate-300'}`}>2</span>
                Customize
             </div>
             <div className="w-12 h-px bg-slate-200 my-auto"></div>
             <div className={`flex items-center gap-2 ${activeStep === 4 ? 'text-slate-900' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${activeStep === 4 ? 'bg-slate-900 text-white' : 'bg-white border-slate-300'}`}>3</span>
                Shopify Checkout
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: 3D Viewer */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="sticky top-28 space-y-6">
                
                {logoConfig.url ? (
                  <Viewer3D ref={viewerRef} logoConfig={logoConfig} detectedColors={analysis?.suggestedColors} />
                ) : (
                  <div className="w-full h-[350px] rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <p className="text-slate-400 font-medium">Preview area</p>
                  </div>
                )}
                
                {/* Features Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-card border border-slate-100 flex flex-col items-center text-center">
                        <Maximize className="w-6 h-6 text-blue-500 mb-2" />
                        <h3 className="font-bold text-sm text-slate-900">AI Auto-Scale</h3>
                        <p className="text-xs text-slate-500 mt-1">Maximizes size for impact</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-card border border-slate-100 flex flex-col items-center text-center">
                        <Palette className="w-6 h-6 text-purple-500 mb-2" />
                        <h3 className="font-bold text-sm text-slate-900">4-Color Limit</h3>
                        <p className="text-xs text-slate-500 mt-1">Smart color reduction</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-card border border-slate-100 flex flex-col items-center text-center">
                        <ShieldCheck className="w-6 h-6 text-emerald-500 mb-2" />
                        <h3 className="font-bold text-sm text-slate-900">AI Verified</h3>
                        <p className="text-xs text-slate-500 mt-1">FDM Compatibility Check</p>
                    </div>
                </div>
            </div>
          </div>

          {/* Right Column: Dynamic Steps */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* STEP 1 & 2: Upload and Verification Result */}
            {(activeStep === 1 || activeStep === 2) && (
                <div className="bg-white rounded-2xl p-6 shadow-card border border-slate-100 transition-all">
                    <h2 className="text-lg font-display font-bold text-slate-900 mb-4">
                      {activeStep === 1 ? '1. Upload Design' : 'Processing Design...'}
                    </h2>
                    
                    {activeStep === 1 && (
                        <div className="relative group rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer bg-slate-50/50">
                            <input 
                                type="file" 
                                accept="image/png, image/jpeg, .pdf"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            />
                            <div className="p-8 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Upload className="w-5 h-5 text-slate-600 group-hover:text-blue-500" />
                                </div>
                                <p className="font-semibold text-slate-700">Click to upload image</p>
                                <p className="text-xs text-slate-400 mt-1">Auto-centers & removes background</p>
                            </div>
                        </div>
                    )}

                    {activeStep === 2 && !analysis && (
                        <div className="p-10 flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl">
                            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                            <h3 className="font-bold text-slate-800">Processing</h3>
                            <p className="text-sm text-slate-500 mt-2">{processingStatus || "Analyzing..."}</p>
                        </div>
                    )}

                    {/* Verification Failed State */}
                    {activeStep === 2 && analysis && !analysis.isPrintable && (
                        <div className="p-6 bg-amber-50 rounded-xl border border-amber-200 text-center animate-fade-in">
                            <XCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                            <h3 className="font-bold text-amber-900 text-lg">Adjustments Required</h3>
                            <p className="text-amber-800 text-sm my-3">{analysis.reasoning}</p>
                            <button 
                                onClick={resetUpload}
                                className="text-sm font-semibold text-amber-700 underline hover:text-amber-900"
                            >
                                Upload a different file
                            </button>
                        </div>
                    )}

                    {fileError && <p className="text-red-500 text-xs mt-3 bg-red-50 p-2 rounded-lg">{fileError}</p>}
                </div>
            )}

            {/* STEP 3: Customize (Only shown if Verified) */}
            {activeStep >= 3 && analysis && (
             <div className="bg-white rounded-2xl p-6 shadow-card border border-slate-100 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-display font-bold text-slate-900">
                        {activeStep === 3 ? '2. Customize' : '3. Finalize Order'}
                    </h2>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-bold text-green-700">Printable</span>
                    </div>
                </div>

                {activeStep === 3 && (
                <div className="space-y-5">
                    {/* Sliders */}
                    <div className="p-5 bg-slate-50 rounded-xl space-y-5 border border-slate-100">
                        
                        {/* Information about Auto-Scale */}
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100 mb-2">
                             <Sparkles className="w-3 h-3" />
                             <span>AI optimized size to {analysis.recommendedScale}mm</span>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <span className="flex items-center gap-1"><Move className="w-3 h-3"/> Position</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input 
                                    type="range" min="-15" max="15" step="0.5"
                                    value={logoConfig.x}
                                    onChange={(e) => setLogoConfig(prev => ({...prev, x: parseFloat(e.target.value)}))}
                                    className="h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 w-full"
                                />
                                <input 
                                    type="range" min="-15" max="15" step="0.5"
                                    value={logoConfig.y}
                                    onChange={(e) => setLogoConfig(prev => ({...prev, y: parseFloat(e.target.value)}))}
                                    className="h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 w-full"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <span className="flex items-center gap-1"><Maximize className="w-3 h-3"/> Scale</span>
                                <span>{logoConfig.scale}mm</span>
                            </div>
                            <input 
                                type="range" min="5" max="39" step="1"
                                value={logoConfig.scale}
                                onChange={(e) => setLogoConfig(prev => ({...prev, scale: parseFloat(e.target.value)}))}
                                className="h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 w-full"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <span className="flex items-center gap-1"><RotateCw className="w-3 h-3"/> Rotation</span>
                                    <span>{Math.round(logoConfig.rotation * (180/Math.PI))}°</span>
                            </div>
                            <input 
                                type="range" min="0" max={Math.PI * 2} step="0.1"
                                value={logoConfig.rotation}
                                onChange={(e) => setLogoConfig(prev => ({...prev, rotation: parseFloat(e.target.value)}))}
                                className="h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 w-full"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleProceedToCheckout}
                        className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                    >
                        Proceed to Checkout <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
                )}

                {/* STEP 4: Shopify Integration */}
                {activeStep === 4 && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Summary Card */}
                        <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                             <div className="flex justify-between items-center mb-4">
                                 <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <Package className="w-3 h-3" /> Order Summary
                                 </span>
                            </div>
                            <div className="space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between">
                                    <span>Custom Keychain (40mm)</span>
                                    <span className="font-semibold">$14.99</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Complexity Fee</span>
                                    <span className="font-semibold">+${((analysis.estimatedPrice - 14.99).toFixed(2))}</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                                <span className="font-bold text-slate-900">Total</span>
                                <span className="font-display font-bold text-2xl text-slate-900">${analysis.estimatedPrice.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Retention & Checkout Action */}
                        <div className="p-6 bg-slate-900 text-white rounded-xl shadow-lg relative overflow-hidden">
                             {/* Background accent */}
                             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                             
                             <div className="relative z-10">
                                 <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                     <ShoppingCart className="w-5 h-5 text-blue-400" />
                                     Ready to Print?
                                 </h3>
                                 <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                                     We will securely save your 3D model configuration and transfer you to our Shopify store to complete payment.
                                 </p>
                                 
                                 <div className="bg-slate-800/50 rounded-lg p-3 mb-6 flex items-start gap-3 border border-slate-700">
                                     <Database className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                                     <div className="text-xs text-slate-400">
                                         <span className="text-white font-semibold">Data Retention:</span> Your design settings (Scale: {logoConfig.scale}mm, Colors: {analysis.suggestedColors.length}) will be linked to your order automatically.
                                     </div>
                                 </div>
                                 
                                 <button 
                                    onClick={handleShopifyCheckout}
                                    disabled={redirectStatus !== 'idle'}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                 >
                                     {redirectStatus === 'idle' && (
                                         <>Pay ${analysis.estimatedPrice.toFixed(2)} on Shopify <ArrowRight className="w-5 h-5" /></>
                                     )}
                                     {redirectStatus === 'saving' && (
                                         <><Loader2 className="w-5 h-5 animate-spin" /> Saving Design...</>
                                     )}
                                     {redirectStatus === 'redirecting' && (
                                         <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting...</>
                                     )}
                                 </button>
                             </div>
                        </div>
                        
                        <button 
                            onClick={() => setActiveStep(3)}
                            className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
                        >
                            Back to Customization
                        </button>
                    </div>
                )}
             </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
