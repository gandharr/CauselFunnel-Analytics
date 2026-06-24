import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, MousePointer, Layers, CheckCircle, Tag, Sparkles, Send, Clock, AlertTriangle, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import causalfunnelLogo from '../assets/images/causalfunnel_logo_1782107327101.jpg';

interface WebsiteSandboxProps {
  onEventSent: () => void;
  currentSessionId: string;
  onResetSessionId: () => void;
}

export default function WebsiteSandbox({ onEventSent, currentSessionId, onResetSessionId }: WebsiteSandboxProps) {
  const [activePath, setActivePath] = useState<string>('/home');
  const [cartCount, setCartCount] = useState<number>(0);
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [lastActionMsg, setLastActionMsg] = useState<string>('');
  const [newsletterSuccess, setNewsletterSuccess] = useState<boolean>(false);
  const [subscribedEmail, setSubscribedEmail] = useState<string>('');

  // 30-second sliding inactivity timer states
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isIdle, setIsIdle] = useState<boolean>(false);

  // Any telemetry event resetting our sliding inactivity gate
  const resetSlideTimer = useCallback(() => {
    if (!isIdle) {
      setSecondsRemaining(30);
    }
  }, [isIdle]);

  const handleTriggerSessionEnd = useCallback(async () => {
    setIsIdle(true);
    // Send standard session_end event safely to traceAverageDurations and close database records
    const payload = {
      sessionId: currentSessionId,
      eventType: 'session_end',
      pageUrl: `https://causalfunnel-demo.com${activePath}`,
      pathname: activePath,
      timestamp: Date.now(),
      referrer: 'https://sandbox.causalfunnel.com',
      userAgent: navigator.userAgent,
    };

    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onEventSent();
      setLastActionMsg('Session ended automatically due to inactivity.');
    } catch (err) {
      console.error('Failed to dispatch session_end event:', err);
    }
  }, [currentSessionId, activePath, onEventSent]);

  const restartNewSession = () => {
    setIsIdle(false);
    setSecondsRemaining(30);
    onResetSessionId();
    setLastActionMsg('A brand new buyer journey session starts!');
  };

  // Handle reporting trackable logs to back-end
  const dispatchTrackerEvent = useCallback(async (
    eventType: 'page_view' | 'click' | 'session_end',
    extraData: {
      x?: number;
      y?: number;
      xPct?: number;
      yPct?: number;
      elementId?: string;
      elementText?: string;
      elementSelectorPath?: string;
    },
    clickEvent?: React.MouseEvent
  ) => {
    // Reset our sliding inactivity state
    resetSlideTimer();

    // Generate mouse coordinate percentiles inside the sandbox viewport container
    let coordData = {};
    let customSelector = '';
    
    if (eventType === 'click' && clickEvent && typeof clickEvent.clientX === 'number') {
      const container = clickEvent.currentTarget.getBoundingClientRect();
      if (container) {
        const relativeX = clickEvent.clientX - container.left;
        const relativeY = clickEvent.clientY - container.top;
        
        const width = container.width || 1;
        const height = container.height || 1;

        coordData = {
          x: Math.round(relativeX),
          y: Math.round(relativeY),
          xPct: Number((relativeX / width).toFixed(4)),
          yPct: Number((relativeY / height).toFixed(4)),
          screenWidth: Math.round(width),
          screenHeight: Math.round(height),
        };
      }

      // Compute precise hierarchical element path selector
      try {
        const target = clickEvent.target as HTMLElement;
        if (target) {
          const selectPath: string[] = [];
          let node: HTMLElement | null = target;
          while (node && node.id !== 'website-sandbox-root') {
            let item = node.tagName.toLowerCase();
            if (node.id) {
              item += `#${node.id}`;
              selectPath.unshift(item);
              break;
            } else if (node.className && typeof node.className === 'string') {
              const mainClass = node.className.trim().split(/\s+/)[0];
              if (mainClass && !mainClass.includes(':') && !mainClass.startsWith('hover') && !mainClass.startsWith('focus')) {
                item += `.${mainClass}`;
              }
            }
            selectPath.unshift(item);
            node = node.parentElement;
          }
          customSelector = selectPath.join(' ➔ ');
        }
      } catch (e) {
        console.warn('Could not extract selector path:', e);
      }
    }

    const payload = {
      sessionId: currentSessionId,
      eventType,
      pageUrl: `https://causalfunnel-demo.com${activePath}`,
      pathname: activePath,
      timestamp: Date.now(),
      referrer: 'https://sandbox.causalfunnel.com',
      userAgent: navigator.userAgent,
      elementSelectorPath: extraData.elementSelectorPath || customSelector || undefined,
      ...coordData,
      ...extraData,
    };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onEventSent();
        if (eventType === 'click') {
          const coordinatesX = (coordData as any).x ?? 0;
          const coordinatesY = (coordData as any).y ?? 0;
          setLastActionMsg(`Tracked Click: "${extraData.elementText || 'Element'}" at (${coordinatesX}, ${coordinatesY})`);
        } else if (eventType === 'session_end') {
          setLastActionMsg('Session closed successfully.');
        } else {
          setLastActionMsg(`Tracked Page View: ${activePath}`);
        }
        // Clear message after 3.5s
        setTimeout(() => setLastActionMsg(''), 3500);
      }
    } catch (err) {
      console.error('Sandbox failed to submit telemetry:', err);
    }
  }, [currentSessionId, activePath, onEventSent, resetSlideTimer]);

  // Automatically track idle countdown inside the sandbox
  useEffect(() => {
    if (isIdle) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTriggerSessionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isIdle, handleTriggerSessionEnd]);

  // Automatically trigger a page view whenever pathname changes
  useEffect(() => {
    dispatchTrackerEvent('page_view', {});
  }, [activePath, dispatchTrackerEvent]);

  // Click wrapper targeting generic interactive components
  const handleItemClick = (e: React.MouseEvent, elementId: string, elementText: string) => {
    dispatchTrackerEvent('click', { elementId, elementText }, e);
  };

  const navigateTo = (path: string, e: React.MouseEvent) => {
    // first log the click to the navigation link
    dispatchTrackerEvent('click', { elementId: `nav-${path.replace('/', '')}`, elementText: `Link: ${path}` }, e);
    // then swap simulated pages
    setTimeout(() => {
      setActivePath(path);
    }, 100);
  };

  const submitNewsletter = (e: React.FormEvent, clickEvent?: React.MouseEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    
    // Dispatch the click event safely
    dispatchTrackerEvent('click', { 
      elementId: 'newsletter-submit-btn', 
      elementText: `Newsletter Submit: ${newsletterEmail}` 
    }, clickEvent);
    
    setSubscribedEmail(newsletterEmail);
    setNewsletterSuccess(true);
    setNewsletterEmail('');
    
    // Auto-dismiss the success state after 4 seconds
    setTimeout(() => {
      setNewsletterSuccess(false);
    }, 4000);
  };

  return (
    <div id="website-sandbox-root" className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden flex flex-col h-[580px] relative transition-all duration-300">
      
      {/* Sandbox Timeout Overlay */}
      {isIdle && (
        <div className="absolute inset-0 z-50 bg-slate-950/98 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 transition-all duration-300">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/35 animate-pulse">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">Simulation Session Expired</h3>
          <p className="text-xs text-slate-350 max-w-sm mb-5">
            Your sandbox journey went inactive for 30s. A <strong>session_end</strong> event beacon was sent to the pipeline to keep session metrics pristine.
          </p>
          <button
            onClick={restartNewSession}
            id="sandbox-restart-session-btn"
            className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Spawn New Sandbox Session</span>
          </button>
        </div>
      )}      {/* Sandbox Top Bar with Site URL bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 shrink-0 select-none overflow-x-auto sm:overflow-visible">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mock Red, Yellow, Green window buttons */}
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
          </div>
          <span className="ml-1 px-1.5 py-0.5 text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded font-black uppercase tracking-wider shrink-0">Sandbox</span>
        </div>
        
        {/* Address URL input with strict width boundaries and truncate support */}
        <div className="flex-1 max-w-sm min-w-[140px] shrink-0 sm:shrink">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-500 font-mono shadow-inner overflow-hidden whitespace-nowrap">
            <span className="text-slate-400 select-none shrink-0">https://</span>
            <span className="text-indigo-600 font-bold shrink-0">demo-funnel.com</span>
            <span className="text-slate-800 font-semibold truncate max-w-[60px] sm:max-w-[150px]">{activePath}</span>
          </div>
        </div>

        {/* Sliding Countdown Timer & Trigger Actions (always visible, never wrapping) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-bold font-mono shrink-0">
            <Clock className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Idle: {secondsRemaining}s</span>
          </div>

          <button
            onClick={handleTriggerSessionEnd}
            className="hover:bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-md border border-slate-200 font-bold transition-colors cursor-pointer shrink-0"
            title="Simulate Inactivity to close session"
          >
            Force End
          </button>
        </div>
      </div>

      {/* Mock Navigation Menu (Fixed at the top, outside scrolling viewport) */}
      <header className="flex justify-between items-center px-5 py-3 border-b border-slate-100 bg-white select-none shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm tracking-tight cursor-pointer" onClick={(e) => navigateTo('/home', e)}>
          <div className="w-6 h-6 rounded-md overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
            <img 
              src={causalfunnelLogo} 
              alt="CF Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-800">ApexFunnel</span>
        </div>
        <nav className="flex gap-4 text-xs font-semibold text-slate-600">
          <button 
            id="nav-home"
            onClick={(e) => navigateTo('/home', e)} 
            className={`hover:text-indigo-600 transition-colors cursor-pointer ${activePath === '/home' ? 'text-indigo-600 font-bold border-b-2 border-indigo-600 pb-0.5' : ''}`}
          >
            Home
          </button>
          <button 
            id="nav-products"
            onClick={(e) => navigateTo('/products', e)} 
            className={`hover:text-indigo-600 transition-colors cursor-pointer ${activePath === '/products' ? 'text-indigo-600 font-bold border-b-2 border-indigo-600 pb-0.5' : ''}`}
          >
            Features
          </button>
          <button 
            id="nav-pricing"
            onClick={(e) => navigateTo('/pricing', e)} 
            className={`hover:text-indigo-600 transition-colors cursor-pointer ${activePath.startsWith('/pricing') ? 'text-indigo-600 font-bold border-b-2 border-indigo-600 pb-0.5' : ''}`}
          >
            Pricing
          </button>
        </nav>
        <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full cursor-pointer text-xs text-slate-700 font-medium transition"
             onClick={(e) => handleItemClick(e, 'cart-badge-trigger', 'Open View Cart')}>
          <ShoppingCart className="w-3.5 h-3.5 text-slate-605" />
          <span className="hidden sm:inline">Cart</span>
          <span className="bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded-full text-[10px]">{cartCount}</span>
        </div>
      </header>

      {/* Target Sandbox inner document views */}
      <div className="flex-1 overflow-y-auto p-5 relative select-none bg-slate-50/50">
        <AnimatePresence mode="wait">

          {/* Path Content: Home */}
          {activePath === '/home' && (
            <motion.div 
              key="/home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="space-y-5"
            >
            {/* Hero banner */}
            <div 
              id="hero-banner-container"
              onClick={(e) => handleItemClick(e, 'hero-banner-container', 'Interact with Hero Area')}
              className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white rounded-xl p-5 text-center shadow-lg relative overflow-hidden cursor-crosshair border border-indigo-950"
            >
              <div className="absolute top-0 right-0 p-2 opacity-15">
                <Sparkles className="w-20 h-20 text-indigo-200 animate-pulse" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mb-1.5 leading-snug">Identify High-Intent Buyers in Real Time</h2>
              <p className="text-[10.5px] leading-relaxed text-indigo-200/90 max-w-sm mx-auto mb-3.5">
                CausalFunnel tracks user journeys and serves interactive prompts dynamically to convert window shoppers.
              </p>
              <div className="flex justify-center gap-2.5">
                <button
                  id="hero-btn-cta"
                  onClick={(e) => {
                    e.stopPropagation(); // Avoid double double logging
                    navigateTo('/pricing', e);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 font-semibold text-[11px] px-3.5 py-1.5 rounded-lg text-white shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
                >
                  See Pricing
                </button>
                <button
                  id="hero-btn-learn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateTo('/products', e);
                  }}
                  className="bg-white/10 hover:bg-white/20 font-semibold text-[11px] px-3.5 py-1.5 rounded-lg text-white transition-all cursor-pointer"
                >
                  Explore Tech
                </button>
              </div>
            </div>

            {/* Features layout */}
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2.5">Core Engines</h3>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  id="home-feature-tracking"
                  onClick={(e) => handleItemClick(e, 'home-feature-tracking', 'Click Intent Tracking Feature')}
                  className="bg-white hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-150 p-3 rounded-lg cursor-pointer transition text-left shadow-xs"
                >
                  <MousePointer className="w-4 h-4 text-indigo-600 mb-1.5" />
                  <h4 className="text-xs font-bold text-slate-800">Smarter Analytics</h4>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">High-fidelity click coordinates and visual journey tracing.</p>
                </div>
                <div 
                  id="home-feature-funnels"
                  onClick={(e) => handleItemClick(e, 'home-feature-funnels', 'Click Intent Funnel Feature')}
                  className="bg-white hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-150 p-3 rounded-lg cursor-pointer transition text-left shadow-xs"
                >
                  <Layers className="w-4 h-4 text-indigo-600 mb-1.5" />
                  <h4 className="text-xs font-bold text-slate-800">Dynamic UI Prompts</h4>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">Serve promotional popups exactly when shoppers linger.</p>
                </div>
              </div>
            </div>

            {/* Newsletter form */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
              {newsletterSuccess ? (
                <div className="flex flex-col items-center justify-center py-2 text-center animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1.5 animate-bounce">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-850">Successfully Subscribed!</h5>
                  <p className="text-[9px] text-emerald-700 font-medium mt-0.5">
                    Logged <span className="font-mono font-bold text-indigo-700 bg-white border border-indigo-100 px-1 py-0.2 rounded truncate inline-block max-w-[120px] align-middle">{subscribedEmail}</span> as a conversion event.
                  </p>
                </div>
              ) : (
                <>
                  <h4 className="text-xs font-bold text-slate-800 mb-0.5">Get Conversion Playbooks Weekly</h4>
                  <p className="text-[9px] text-slate-500 mb-2.5">No spam, just premium e-commerce growth telemetry.</p>
                  <form onSubmit={(e) => submitNewsletter(e)} className="flex gap-2">
                    <input
                      type="email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="name@email.com"
                      className="flex-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-600 font-sans"
                      required
                    />
                    <button
                      type="submit"
                      id="newsletter-submit-btn"
                      className="bg-slate-850 hover:bg-slate-805 text-white text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Subscribe</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Path Content: Products / Tech Features */}
        {activePath === '/products' && (
          <motion.div 
            key="/products"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <div className="text-center mb-1">
              <h2 className="text-sm font-bold text-slate-800">High Resolution Conversion Tech</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Test individual analytics features to generate real telemetry</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div 
                id="feat-add-item-1"
                onClick={(e) => {
                  setCartCount(prev => prev + 1);
                  handleItemClick(e, 'feat-add-item-1', 'Add Pro Engine to Cart');
                }}
                className="bg-white border border-slate-200 hover:border-indigo-400 p-3 rounded-lg text-left shadow-xs transition group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">V2 Core</span>
                  <span className="text-xs font-extrabold text-slate-700">$49/mo</span>
                </div>
                <h3 className="text-xs font-bold text-slate-800">High-Resolution Tracking</h3>
                <p className="text-[9px] text-slate-500 mt-1 mb-2.5">Real-time heatmaps overlaying elements with SVG grids.</p>
                <button className="w-full bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-700 text-[10px] py-1.5 rounded font-semibold transition">
                  Mock Add to Cart
                </button>
              </div>

              <div 
                id="feat-add-item-2"
                onClick={(e) => {
                  setCartCount(prev => prev + 1);
                  handleItemClick(e, 'feat-add-item-2', 'Add Enterprise Prompt to Cart');
                }}
                className="bg-white border border-slate-200 hover:border-indigo-400 p-3 rounded-lg text-left shadow-xs transition group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] bg-purple-50 border border-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">Prompt AI</span>
                  <span className="text-xs font-extrabold text-slate-700">$199/mo</span>
                </div>
                <h3 className="text-xs font-bold text-slate-800">Smart Prompt Server</h3>
                <p className="text-[9px] text-slate-500 mt-1 mb-2.5">Intercept cart abandonment with smart overlays & sliders.</p>
                <button className="w-full bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-700 text-[10px] py-1.5 rounded font-semibold transition">
                  Mock Add to Cart
                </button>
              </div>
            </div>

            <div 
              id="interactive-feedback-card"
              onClick={(e) => handleItemClick(e, 'interactive-feedback-card', 'Click Feature Feedback Card')}
              className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 text-center cursor-pointer"
            >
              <h4 className="text-xs font-bold text-indigo-900 flex items-center justify-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                <span>Special Launch Offer Active</span>
              </h4>
              <p className="text-[10px] text-indigo-700 mt-1">Get 14 days free premium testing today. No code change needed.</p>
            </div>
          </motion.div>
        )}

        {/* Path Content: Pricing */}
        {activePath === '/pricing' && (
          <motion.div 
            key="/pricing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h2 className="text-sm font-bold text-slate-800">Predictable, Flat-Rate Plans</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Scale analytics limits transparently with your store size</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Product Tier 1 */}
              <div 
                id="pricing-tier-starter"
                onClick={(e) => handleItemClick(e, 'pricing-tier-starter', 'Inspect Starter Tier')}
                className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition text-left"
              >
                <div>
                  <h3 className="text-xs font-bold text-slate-700">Starter Core</h3>
                  <div className="my-2.5">
                    <span className="text-lg font-extrabold text-slate-900">$19</span>
                    <span className="text-[10px] text-slate-400">/mo</span>
                  </div>
                  <ul className="space-y-1 text-[9px] text-slate-500">
                    <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-indigo-500" /> 10,000 monthly sessions</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-indigo-500" /> Interactive basic dashboard</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-indigo-500" /> Page views & Heatmaps</li>
                  </ul>
                </div>
                <button
                  id="pricing-tier-starter-cta"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatchTrackerEvent('click', { elementId: 'pricing-tier-starter-cta', elementText: 'Purchase Starter Tier' }, e);
                    setActivePath('/pricing/success');
                  }}
                  className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white text-[10px] py-1.5 rounded-lg font-bold transition text-center cursor-pointer"
                >
                  Select Starter
                </button>
              </div>

              {/* Product Tier 2 */}
              <div 
                id="pricing-tier-pro"
                onClick={(e) => handleItemClick(e, 'pricing-tier-pro', 'Inspect Pro Tier')}
                className="bg-indigo-50/50 border-2 border-indigo-500 rounded-xl p-3.5 flex flex-col justify-between relative cursor-pointer hover:shadow-md transition text-left"
              >
                <div className="absolute -top-2 px-2 py-0.5 bg-indigo-600 rounded-md text-[8px] text-white font-extrabold tracking-wide uppercase">Most Popular</div>
                <div>
                  <h3 className="text-xs font-extrabold text-indigo-900">Pro Automator</h3>
                  <div className="my-2.5">
                    <span className="text-lg font-extrabold text-slate-900">$49</span>
                    <span className="text-[10px] text-indigo-400">/mo</span>
                  </div>
                  <ul className="space-y-1 text-[9px] text-slate-600">
                    <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-indigo-600" /> 100,000 monthly sessions</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-indigo-600" /> Multi-domain workspaces</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-indigo-600" /> AI checkout behavior prompts</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-indigo-600" /> Premium integration APIs</li>
                  </ul>
                </div>
                <button
                  id="pricing-tier-pro-cta"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatchTrackerEvent('click', { elementId: 'pricing-tier-pro-cta', elementText: 'Purchase Pro Tier ($49/mo)' }, e);
                    setActivePath('/pricing/success');
                  }}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] py-1.5 rounded-lg font-bold transition text-center cursor-pointer"
                >
                  Buy Pro Now
                </button>
              </div>
            </div>

            {/* Testimonials or FAQ link click */}
            <div className="flex justify-between items-center px-2 py-1 text-[10px] text-slate-500">
              <span id="faq-toggle-1" className="hover:underline cursor-pointer" onClick={(e) => handleItemClick(e, 'faq-toggle-1', 'FAQ: Cancel policy')}>How refunds work?</span>
              <span id="faq-toggle-2" className="hover:underline cursor-pointer" onClick={(e) => handleItemClick(e, 'faq-toggle-2', 'FAQ: Multi site support')}>Integrates with Shopify?</span>
            </div>
          </motion.div>
        )}

        {/* Path Content: Success */}
        {activePath === '/pricing/success' && (
          <motion.div 
            key="/pricing/success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center justify-center py-6 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Thank You For Your Order!</h2>
            <p className="text-xs text-slate-500 max-w-xs mt-1.5 mb-4">
              Your mock billing subscription was recorded. The corresponding telemetry was safe-transmitted to CausalFunnel servers.
            </p>
            <div className="flex gap-3">
              <button
                id="success-back-btn"
                onClick={(e) => navigateTo('/home', e)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
              >
                Return Home
              </button>
              <button
                id="success-refresh-btn"
                onClick={(e) => {
                  setCartCount(0);
                  navigateTo('/pricing', e);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
              >
                Review Plans
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
      </div>

      {/* Sandbox Footer console debugger */}
      <div className="bg-slate-900 text-slate-400 px-4 py-2 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>CF-Tracker Live Agent Online</span>
        </div>
        <div className="truncate max-w-[320px] text-emerald-400">
          {lastActionMsg || 'Interact anywhere inside container (Clicks automatically track relative coordinate floats)'}
        </div>
      </div>
    </div>
  );
}
