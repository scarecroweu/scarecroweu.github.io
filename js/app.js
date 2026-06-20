(function(){
  const {DEFAULTS,DEFAULT_EFFECTS,SLIDERS,CATEGORIES,PRESETS,BRUSH_TYPES,MAX_PREVIEW,renderToCanvas,renderOriginal,compositePreview,renderExport}=window.PhotoLab;
  const CAM_STRIP_IDS=[0,2,4,9,10,12,28,31,46,55,60,62,67,80,81,89];
  const CAM_STRIP_LABELS=['Portra','Ektar','Gold','Pro 400H','Superia','Natura','Alexa','Teal&Orange','Portra','Tri-X','Clean','Moody','Dreamy','Cyberpunk','Neon Glow','Golden Hr'];
  let currentImage=null,currentFileName='photo';
  let settings={...DEFAULTS},effects={...DEFAULT_EFFECTS};
  let texts=[],selectedTextId=null,textIdCounter=0;
  let activePresetIdx=-1,activeCategory='all',activeTab='presets';
  let isComparing=false,renderPending=false;
  let zoom=1,panX=0,panY=0,isPanning=false,panStartX=0,panStartY=0;
  let activeBrush='blur',brushSize=40,brushStrength=50;
  let isPainting=false,lastBrushX=-1,lastBrushY=-1;
  let baseBuffer=null,strokeBuffer=null,tempBuffer=null;
  let undoStack=[],MAX_UNDO=15;
  let isDraggingText=false,dragTextId=null,dragOffX=0,dragOffY=0;
  let cameraStream=null,cameraActive=false,cameraFacing='environment';
  let cameraAspectRatio=4/3,cameraThumbImage=null;
  let camFilterThumbs=[],activeCamFilter=0;
  const ASPECT_RATIOS=[{id:'4:3',value:4/3,label:'4:3'},{id:'1:1',value:1,label:'1:1'},{id:'16:9',value:16/9,label:'16:9'}];
  let pinchStartDist=0,pinchStartZoom=1,isPinching=false;
  let lastTapTime=0,zoomPillTimer=null;
  let appSettings={showBrushCursor:true,autoFit:true,smoothZoom:true,exportFormat:'png',exportQuality:92};
  let shortcutMap=[
    {id:'undo',label:'Undo Brush',key:'z',ctrl:true,shift:false,alt:false},
    {id:'reset',label:'Reset All',key:'r',ctrl:false,shift:false,alt:false},
    {id:'zoomIn',label:'Zoom In',key:'=',ctrl:false,shift:false,alt:false},
    {id:'zoomOut',label:'Zoom Out',key:'-',ctrl:false,shift:false,alt:false},
    {id:'zoomFit',label:'Fit to View',key:'0',ctrl:false,shift:false,alt:false},
    {id:'compare',label:'Compare',key:' ',ctrl:false,shift:false,alt:false},
    {id:'newImage',label:'New Image',key:'n',ctrl:true,shift:false,alt:false},
    {id:'download',label:'Download',key:'s',ctrl:true,shift:false,alt:false},
    {id:'settings',label:'Open Settings',key:',',ctrl:false,shift:false,alt:false},
  ];
  let rebindingId=null;
  const $=id=>document.getElementById(id);
  const uploadScreen=$('uploadScreen'),editorScreen=$('editorScreen'),uploadZone=$('uploadZone');
  const fileInput=$('fileInput'),browseBtn=$('browseBtn'),takePhotoBtn=$('takePhotoBtn'),cameraHint=$('cameraHint');
  const previewCanvas=$('previewCanvas'),previewArea=$('previewArea'),imageFrame=$('imageFrame'),zoomPill=$('zoomPill');
  const compareLabel=$('compareLabel'),compareBtn=$('compareBtn');
  const newBtn=$('newBtn'),resetBtn=$('resetBtn'),downloadBtn=$('downloadBtn');
  const nightBtn=$('nightBtn'),undoBtn=$('undoBtn'),settingsBtn=$('settingsBtn'),cameraBtn=$('cameraBtn'),sizeBadge=$('sizeBadge');
  const zoomInBtn=$('zoomInBtn'),zoomOutBtn=$('zoomOutBtn'),zoomFitBtn=$('zoomFitBtn'),zoomLabel=$('zoomLabel');
  const categoryBar=$('categoryBar'),presetsGrid=$('presetsGrid'),slidersList=$('slidersList');
  const brushTypesEl=$('brushTypes');
  const brushSizeInput=$('brushSize'),brushStrengthInput=$('brushStrength');
  const brushSizeVal=$('brushSizeVal'),brushStrengthVal=$('brushStrengthVal');
  const clearBrushBtn=$('clearBrushBtn'),brushCursorToggle=$('brushCursorToggle');
  const textList=$('textList'),textProps=$('textProps');
  const addTextBtn=$('addTextBtn'),deleteTextBtn=$('deleteTextBtn');
  const textContent=$('textContent'),textSize=$('textSize'),textSizeVal=$('textSizeVal');
  const textColor=$('textColor'),textFont=$('textFont');
  const textOpacity=$('textOpacity'),textOpacityVal=$('textOpacityVal');
  const textBlur=$('textBlur'),textBlurVal=$('textBlurVal');
  const textGlow=$('textGlow'),textGlowSub=$('textGlowSub');
  const textGlowColor=$('textGlowColor'),textGlowIntensity=$('textGlowIntensity'),textGlowIntensityVal=$('textGlowIntensityVal');
  const textOutline=$('textOutline'),textOutlineSub=$('textOutlineSub');
  const textOutlineColor=$('textOutlineColor'),textOutlineWidth=$('textOutlineWidth'),textOutlineWidthVal=$('textOutlineWidthVal');
  const textLetterSpacing=$('textLetterSpacing'),textLetterSpacingVal=$('textLetterSpacingVal');
  const effectsPanel=$('effectsPanel'),toastEl=$('toast');
  const settingsModal=$('settingsModal'),settingsOverlay=$('settingsOverlay'),closeSettings=$('closeSettings');
  const shortcutList=$('shortcutList');
  const settingBrushCursor=$('settingBrushCursor'),settingAutoFit=$('settingAutoFit');
  const settingSmoothZoom=$('settingSmoothZoom'),settingExportFormat=$('settingExportFormat');
  const settingExportQuality=$('settingExportQuality'),settingExportQualityVal=$('settingExportQualityVal'),qualityRow=$('qualityRow');
  const cameraOverlay=$('cameraOverlay'),cameraVideo=$('cameraVideo'),cameraCropInner=$('cameraCropInner');
  const cameraFlash=$('cameraFlash'),cameraSizeBadge=$('cameraSizeBadge'),cameraRatioBar=$('cameraRatioBar');
  const camFilterStrip=$('camFilterStrip'),shutterBtn=$('shutterBtn');
  const cameraCloseBtn=$('cameraCloseBtn'),cameraSwitchBtn=$('cameraSwitchBtn');

  /* Detect touch-primary for click vs dblclick */
  const IS_TOUCH=window.matchMedia('(hover:none)').matches||('ontouchstart' in window);
  const EDIT_EVT=IS_TOUCH?'click':'dblclick';
  (function(){
    const bp=document.querySelector('.bottom-panel');
    if(!bp)return;
    function fix(){
      if(window.visualViewport){
        const d=window.innerHeight-window.visualViewport.height;
        if(d>4){bp.style.paddingBottom=d+'px';bp.style.boxSizing='border-box';return;}
      }
      const s=getComputedStyle(document.documentElement).getPropertyValue('padding-bottom').trim();
      if(s&&s!=='0px'){bp.style.paddingBottom=s;bp.style.boxSizing='border-box';}
    }
    fix();
    if(window.visualViewport)window.visualViewport.addEventListener('resize',fix);
    window.addEventListener('resize',fix);
  })();
  let toastTimer=null;
  function showToast(m){toastEl.textContent=m;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2500);}
  function fmtVal(v,s){return(s.step?v.toFixed(1):v)+s.unit;}
  function updateFill(inp){const mn=+inp.min,mx=+inp.max,v=+inp.value;inp.style.setProperty('--pct',((v-mn)/(mx-mn)*100)+'%');}
  function screenToCanvas(sx,sy){const r=previewCanvas.getBoundingClientRect();return{x:(sx-r.left)/r.width*previewCanvas.width,y:(sy-r.top)/r.height*previewCanvas.height};}
  function getTouchDist(e){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(dx*dx+dy*dy);}

  /* ═══════ CLICK-TO-EDIT for slider values ═══════ */
  function makeEditable(span,slider,getVal,setVal,step,unit){
    span.style.cursor='pointer';
    function display(v){span.textContent=(step&&step<1?v.toFixed(1):Math.round(v))+(unit||'');}
    span.addEventListener(EDIT_EVT,()=>{
      if(span.dataset.editing)return;span.dataset.editing='1';
      const cur=getVal();
      const input=document.createElement('input');input.type='number';input.className='slider-val-input';
      input.value=step&&step<1?cur.toFixed(1):Math.round(cur);
      if(slider){input.min=slider.min;input.max=slider.max;}
      input.step=step||1;
      span.textContent='';span.appendChild(input);input.focus();input.select();
      function commit(){
        if(!span.dataset.editing)return;
        let v=parseFloat(input.value);if(isNaN(v))v=cur;
        if(slider)v=Math.max(+slider.min,Math.min(+slider.max,v));
        setVal(v);if(slider){slider.value=v;updateFill(slider);}
        if(span.contains(input))span.removeChild(input);
        delete span.dataset.editing;display(v);
      }
      input.addEventListener('blur',commit);
      input.addEventListener('keydown',e=>{
        if(e.key==='Enter'){e.preventDefault();input.blur();}
        if(e.key==='Escape'){input.value=cur;input.blur();}
        e.stopPropagation();
      });
      input.addEventListener('click',e=>e.stopPropagation());
    });
  }

  function checkCameraSupport(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){const p=location.protocol,h=location.hostname;if(p==='file:')return'file';if(p==='http:'&&h!=='localhost'&&h!=='127.0.0.1')return'https';return'unsupported';}return'ok';}
  (function(){if(checkCameraSupport()!=='ok')cameraHint.style.display='block';})();

  function fitCanvasCSS(){if(!currentImage||!previewCanvas.width||cameraActive)return;const rect=previewArea.getBoundingClientRect();const cw=previewCanvas.width,ch=previewCanvas.height;if(!cw||!ch)return;const scale=Math.min(rect.width/cw,rect.height/ch,1);previewCanvas.style.width=Math.round(cw*scale)+'px';previewCanvas.style.height=Math.round(ch*scale)+'px';}
  function showZoomPill(){if(zoom<=1.03&&zoom>=0.97)return;zoomPill.classList.add('visible');clearTimeout(zoomPillTimer);zoomPillTimer=setTimeout(()=>zoomPill.classList.remove('visible'),2500);}
  zoomPill.addEventListener('click',()=>{zoom=1;panX=0;panY=0;applyZoom();zoomPill.classList.remove('visible');clearTimeout(zoomPillTimer);});
  function updateSizeBadge(){if(!currentImage){sizeBadge.style.display='none';return;}sizeBadge.textContent=currentImage.naturalWidth+'\u00d7'+currentImage.naturalHeight;sizeBadge.style.display='inline';}

  /* ═══════ CAMERA ═══════ */
  let camPreviewCanvas=null,camPreviewRAF=null,camLastPreviewTime=0,camLastRenderDur=0,camThumbTimer=null;
  const CAM_PREVIEW_MAX_DIM=Math.min(window.innerWidth<400?360:540,600);
  const CAM_PREVIEW_TARGET_FPS=12;
  function ensureCamPreviewCanvas(){if(camPreviewCanvas)return;camPreviewCanvas=document.createElement('canvas');camPreviewCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;';cameraOverlay.insertBefore(camPreviewCanvas,cameraCropInner);}
  function camPreviewLoop(ts){if(!cameraActive)return;const interval=Math.max(1000/CAM_PREVIEW_TARGET_FPS,camLastRenderDur*1.3);if(ts-camLastPreviewTime<interval){camPreviewRAF=requestAnimationFrame(camPreviewLoop);return;}camLastPreviewTime=ts;const t0=performance.now();if(cameraVideo.videoWidth){const vw=cameraVideo.videoWidth,vh=cameraVideo.videoHeight;const sc=Math.min(CAM_PREVIEW_MAX_DIM/vw,CAM_PREVIEW_MAX_DIM/vh,1);const pw=Math.round(vw*sc),ph=Math.round(vh*sc);if(camPreviewCanvas.width!==pw||camPreviewCanvas.height!==ph){camPreviewCanvas.width=pw;camPreviewCanvas.height=ph;}renderToCanvas(camPreviewCanvas,cameraVideo,settings,0);}camLastRenderDur=performance.now()-t0;camPreviewRAF=requestAnimationFrame(camPreviewLoop);}
  function startCamPreview(){stopCamPreview();ensureCamPreviewCanvas();camPreviewCanvas.style.display='block';cameraVideo.style.visibility='hidden';cameraVideo.style.filter='none';camLastPreviewTime=0;camLastRenderDur=0;camPreviewRAF=requestAnimationFrame(camPreviewLoop);}
  function stopCamPreview(){if(camPreviewRAF){cancelAnimationFrame(camPreviewRAF);camPreviewRAF=null;}if(camPreviewCanvas)camPreviewCanvas.style.display='none';cameraVideo.style.visibility='';}
  function captureFreshThumbnail(){if(!cameraActive||!cameraVideo.videoWidth)return;const tc=document.createElement('canvas');tc.width=48;tc.height=48;const tctx=tc.getContext('2d');const vw=cameraVideo.videoWidth,vh=cameraVideo.videoHeight,sz=Math.min(vw,vh);tctx.drawImage(cameraVideo,(vw-sz)/2,(vh-sz)/2,sz,sz,0,0,48,48);const img=new Image();img.onload=()=>{cameraThumbImage=img;updateCamFilterThumbs();};img.src=tc.toDataURL();}
  function startCamThumbUpdates(){stopCamThumbUpdates();captureFreshThumbnail();camThumbTimer=setInterval(captureFreshThumbnail,2000);}
  function stopCamThumbUpdates(){if(camThumbTimer){clearInterval(camThumbTimer);camThumbTimer=null;}}
  function updateCameraCrop(){if(!cameraActive)return;const r=previewArea.getBoundingClientRect(),aW=r.width,aH=r.height-130;let bW,bH;if(aW/aH>cameraAspectRatio){bH=aH;bW=aH*cameraAspectRatio;}else{bW=aW-14;bH=(aW-14)/cameraAspectRatio;}cameraCropInner.style.width=Math.round(bW)+'px';cameraCropInner.style.height=Math.round(bH)+'px';}
  function updateCameraSizeBadge(){if(!cameraActive||!cameraVideo.videoWidth){cameraSizeBadge.textContent='';return;}const vw=cameraVideo.videoWidth,vh=cameraVideo.videoHeight,vr=vw/vh;let w,h;if(vr>cameraAspectRatio){h=vh;w=Math.round(vh*cameraAspectRatio);}else{w=vw;h=Math.round(vw/cameraAspectRatio);}cameraSizeBadge.textContent=w+'\u00d7'+h;}

  function buildCamFilterStrip(){
    camFilterStrip.innerHTML='';camFilterThumbs=[];
    const noneItem=document.createElement('div');noneItem.className='cam-filter-item'+(activeCamFilter===-1?' active':'');
    noneItem.innerHTML='<div class="cam-filter-thumb"><canvas width="48" height="48"></canvas></div><div class="cam-filter-name">None</div>';
    noneItem.addEventListener('click',()=>{activeCamFilter=-1;settings={...DEFAULTS};updateCamFilterActive();});
    camFilterStrip.appendChild(noneItem);camFilterThumbs.push({el:noneItem,idx:-1,canvas:noneItem.querySelector('canvas')});
    CAM_STRIP_IDS.forEach((pidx,i)=>{const pr=PRESETS[pidx];if(!pr)return;const item=document.createElement('div');item.className='cam-filter-item'+(activeCamFilter===pidx?' active':'');item.innerHTML='<div class="cam-filter-thumb"><canvas width="48" height="48"></canvas></div><div class="cam-filter-name">'+(CAM_STRIP_LABELS[i]||pr.name)+'</div>';item.addEventListener('click',()=>{activeCamFilter=pidx;Object.keys(DEFAULTS).forEach(k=>{settings[k]=pr[k]!==undefined?pr[k]:DEFAULTS[k];});updateCamFilterActive();});camFilterStrip.appendChild(item);camFilterThumbs.push({el:item,idx:pidx,canvas:item.querySelector('canvas')});});
    updateCamFilterActive();
  }
  function updateCamFilterActive(){camFilterThumbs.forEach(t=>t.el.classList.toggle('active',t.idx===activeCamFilter));}
  function updateCamFilterThumbs(){if(!cameraActive||!cameraThumbImage)return;camFilterThumbs.forEach(t=>{const pr=t.idx===-1?DEFAULTS:PRESETS[t.idx];if(pr)renderToCanvas(t.canvas,cameraThumbImage,pr,48);});}

  function stopCameraStream(){stopCamPreview();stopCamThumbUpdates();if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}cameraActive=false;cameraOverlay.style.display='none';previewCanvas.style.display='block';imageFrame.style.display='inline-block';cameraThumbImage=null;}
  function cameraGoBack(){if(!currentImage){editorScreen.classList.remove('visible');uploadScreen.classList.remove('hidden');}}
  function closeCamera(){stopCameraStream();if(!currentImage)cameraGoBack();else requestRender();}

  async function openCamera(){
    const cs=checkCameraSupport();if(cs!=='ok'){if(cs==='file')showToast('Camera needs a web server');else if(cs==='https')showToast('Camera requires HTTPS');else showToast('Camera not supported');cameraGoBack();return;}
    try{
      if(cameraStream)stopCameraStream();
      const sets=[{video:{facingMode:{ideal:cameraFacing},width:{ideal:1920},height:{ideal:1080}},audio:false},{video:{facingMode:cameraFacing},audio:false},{video:true,audio:false}];
      let stream=null;for(const c of sets){try{stream=await navigator.mediaDevices.getUserMedia(c);break;}catch(e){stream=null;if(e.name==='NotAllowedError'||e.name==='PermissionDeniedError'){showToast('Camera permission denied');cameraGoBack();return;}}}
      if(!stream){showToast('Could not access camera');cameraGoBack();return;}
      cameraStream=stream;cameraVideo.srcObject=stream;await cameraVideo.play();
      cameraActive=true;cameraOverlay.style.display='flex';previewCanvas.style.display='none';imageFrame.style.display='none';
      activeCamFilter=CAM_STRIP_IDS[0];const defPr=PRESETS[CAM_STRIP_IDS[0]];Object.keys(DEFAULTS).forEach(k=>{settings[k]=defPr[k]!==undefined?defPr[k]:DEFAULTS[k];});
      buildCamFilterStrip();
      const onReady=()=>{updateCameraSizeBadge();startCamPreview();startCamThumbUpdates();};
      if(cameraVideo.readyState>=1)onReady();else cameraVideo.addEventListener('loadedmetadata',onReady,{once:true});
      setTimeout(()=>{camFilterStrip.classList.add('visible');updateCameraCrop();},200);
    }catch(err){console.error(err);if(err.name==='NotAllowedError')showToast('Camera permission denied');else if(err.name==='NotFoundError')showToast('No camera found');else if(err.name==='NotReadableError')showToast('Camera in use');else showToast('Camera error');cameraGoBack();}
  }
  async function switchCamera(){cameraFacing=cameraFacing==='environment'?'user':'environment';await openCamera();}

  function capturePhoto(){
    if(!cameraActive||!cameraVideo.videoWidth)return;
    cameraFlash.classList.add('flash');setTimeout(()=>cameraFlash.classList.remove('flash'),300);
    shutterBtn.classList.add('capturing');setTimeout(()=>shutterBtn.classList.remove('capturing'),200);
    const vw=cameraVideo.videoWidth,vh=cameraVideo.videoHeight,vr=vw/vh;
    let cW,cH,cX,cY;if(vr>cameraAspectRatio){cH=vh;cW=vh*cameraAspectRatio;cX=(vw-cW)/2;cY=0;}else{cW=vw;cH=vw/cameraAspectRatio;cX=0;cY=(vh-cH)/2;}
    const cc=document.createElement('canvas');cc.width=Math.round(cW);cc.height=Math.round(cH);cc.getContext('2d').drawImage(cameraVideo,cX,cY,cW,cH,0,0,cc.width,cc.height);
    const savedSettings={...settings},savedEffects={...effects};
    const img=new Image();img.onload=()=>{
      currentImage=img;currentFileName='photo_'+Date.now()+'.jpg';
      baseBuffer=null;strokeBuffer=null;tempBuffer=null;undoStack=[];
      settings=savedSettings;effects=savedEffects;
      texts=[];selectedTextId=null;textProps.style.display='none';renderTextList();activePresetIdx=-1;
      SLIDERS.forEach(s=>{const i=$('sl_'+s.id),v=$('vl_'+s.id);i.value=settings[s.id];v.textContent=fmtVal(settings[s.id],s);updateFill(i);});
      document.querySelectorAll('.preset-item').forEach(el=>el.classList.remove('active'));
      clearBrushStrokes();buildEffectsPanel();stopCameraStream();
      initBuffers();renderToCanvas(baseBuffer,currentImage,settings,0);
      compositePreview(previewCanvas,baseBuffer,strokeBuffer,effects,texts);fitCanvasCSS();
      uploadScreen.classList.add('hidden');editorScreen.classList.add('visible');
      if(appSettings.autoFit){zoom=1;panX=0;panY=0;applyZoom();}
      updateBrushCursor();updateSizeBadge();setTimeout(()=>renderPresetGrid(),120);
    };img.src=cc.toDataURL('image/jpeg',0.95);
  }

  ASPECT_RATIOS.forEach(ar=>{const b=document.createElement('button');b.className='ratio-btn'+(ar.value===cameraAspectRatio?' active':'');b.textContent=ar.label;b.dataset.ratio=ar.value;b.addEventListener('click',()=>{cameraAspectRatio=ar.value;document.querySelectorAll('.ratio-btn').forEach(x=>x.classList.toggle('active',+x.dataset.ratio===ar.value));updateCameraCrop();updateCameraSizeBadge();});cameraRatioBar.appendChild(b);});
  takePhotoBtn.addEventListener('click',()=>{uploadScreen.classList.add('hidden');editorScreen.classList.add('visible');openCamera();});
  cameraBtn.addEventListener('click',()=>{if(cameraActive)closeCamera();else openCamera();});
  cameraCloseBtn.addEventListener('click',closeCamera);cameraSwitchBtn.addEventListener('click',switchCamera);shutterBtn.addEventListener('click',capturePhoto);

  /* ═══════ BUILD UI ═══════ */
  CATEGORIES.forEach(c=>{const b=document.createElement('button');b.className='cat-pill'+(c.id==='all'?' active':'');b.textContent=c.label;b.dataset.cat=c.id;b.addEventListener('click',()=>{activeCategory=c.id;document.querySelectorAll('.cat-pill').forEach(p=>p.classList.toggle('active',p.dataset.cat===c.id));renderPresetGrid();});categoryBar.appendChild(b);});

  let lastSec='';
  SLIDERS.forEach(s=>{
    if(s.section!==lastSec){lastSec=s.section;const h=document.createElement('div');h.className='slider-section';h.textContent=s.section;slidersList.appendChild(h);}
    const row=document.createElement('div');row.className='slider-row';
    const lbl=document.createElement('div');lbl.className='slider-label';lbl.textContent=s.label;
    const wrap=document.createElement('div');wrap.className='slider-wrap';
    const inp=document.createElement('input');inp.type='range';inp.id='sl_'+s.id;inp.min=s.min;inp.max=s.max;inp.value=s.def;if(s.step)inp.step=s.step;
    const val=document.createElement('span');val.className='slider-val';val.id='vl_'+s.id;val.textContent=fmtVal(s.def,s);
    updateFill(inp);
    inp.addEventListener('input',()=>{settings[s.id]=+inp.value;val.textContent=fmtVal(+inp.value,s);updateFill(inp);requestRender();deselectPreset();});
    makeEditable(val,inp,()=>settings[s.id],v=>{settings[s.id]=v;requestRender();deselectPreset();},s.step,s.unit);
    wrap.appendChild(inp);row.appendChild(lbl);row.appendChild(wrap);row.appendChild(val);slidersList.appendChild(row);
  });

  /* ── BRUSH UI ── */
  BRUSH_TYPES.forEach(b=>{const btn=document.createElement('button');btn.className='brush-type-btn'+(b.id===activeBrush?' active':'');btn.innerHTML='<i class="'+b.icon+'"></i> '+b.label;btn.dataset.brush=b.id;btn.addEventListener('click',()=>{activeBrush=b.id;document.querySelectorAll('.brush-type-btn').forEach(x=>x.classList.toggle('active',x.dataset.brush===activeBrush));});brushTypesEl.appendChild(btn);});
  brushSizeInput.addEventListener('input',()=>{brushSize=+brushSizeInput.value;brushSizeVal.textContent=brushSize;updateFill(brushSizeInput);updateBrushCursor();});
  brushStrengthInput.addEventListener('input',()=>{brushStrength=+brushStrengthInput.value;brushStrengthVal.textContent=brushStrength;updateFill(brushStrengthInput);});
  updateFill(brushSizeInput);updateFill(brushStrengthInput);
  makeEditable(brushSizeVal,brushSizeInput,()=>brushSize,v=>{brushSize=v;updateBrushCursor();},1,'');
  makeEditable(brushStrengthVal,brushStrengthInput,()=>brushStrength,v=>{brushStrength=v;},1,'');
  brushCursorToggle.addEventListener('change',()=>{appSettings.showBrushCursor=brushCursorToggle.checked;settingBrushCursor.checked=brushCursorToggle.checked;updateBrushCursor();});
  clearBrushBtn.addEventListener('click',()=>{clearBrushStrokes();showToast('Brush strokes cleared');});

  /* ── EFFECTS PANEL ── */
  function buildEffectsPanel(){effectsPanel.innerHTML='';const ds=[];if(effects.dateStamp){ds.push({type:'select',label:'Style',value:effects.dateStampStyle,options:[['canon','Canon'],['nikon','Nikon'],['sony','Sony'],['fuji','Fuji'],['film','Film Stamp'],['camera','Camera Metadata']],onChange:v=>{effects.dateStampStyle=v;requestRender();buildEffectsPanel();}});ds.push({type:'select',label:'Language',value:effects.dateStampLang,options:[['en','English'],['ja','Japanese'],['zh','Chinese'],['ko','Korean'],['de','German'],['fr','French'],['iso','ISO 8601']],onChange:v=>{effects.dateStampLang=v;requestRender();}});ds.push({type:'color',label:'Color',value:effects.dateStampColor,onChange:v=>{effects.dateStampColor=v;requestRender();}});ds.push({type:'select',label:'Position',value:effects.dateStampPos,options:[['bottom-right','Bottom Right'],['bottom-left','Bottom Left'],['top-right','Top Right'],['top-left','Top Left']],onChange:v=>{effects.dateStampPos=v;requestRender();}});ds.push({type:'toggle',label:'Show Camera Name',checked:effects.dateStampShowCamera,onChange:v=>{effects.dateStampShowCamera=v;requestRender();buildEffectsPanel();}});if(effects.dateStampShowCamera)ds.push({type:'text',label:'Camera',value:effects.dateStampCamera,onChange:v=>{effects.dateStampCamera=v;requestRender();}});}effectsPanel.appendChild(makeToggleGroup('Date Stamp',effects.dateStamp,v=>{effects.dateStamp=v;requestRender();deselectPreset();buildEffectsPanel();},ds));effectsPanel.appendChild(makeSliderGroup('Color Shift (Glitch)',effects.colorShift,0,10,1,'px',v=>{effects.colorShift=+v;requestRender();deselectPreset();}));const fg=document.createElement('div');fg.className='effect-group';const fh=document.createElement('div');fh.className='effect-header';fh.innerHTML='<span class="effect-label">Frame</span>';const fs=document.createElement('select');fs.className='effect-select';[['none','None'],['polaroid','Polaroid'],['white','White Matte'],['black','Black Mount'],['film-strip','Film Strip'],['dark-slide','Dark Slide'],['vintage','Vintage'],['instax','Instax']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(effects.frame===v)o.selected=true;fs.appendChild(o);});fs.addEventListener('change',()=>{effects.frame=fs.value;requestRender();deselectPreset();});fh.appendChild(fs);fg.appendChild(fh);effectsPanel.appendChild(fg);}

  function makeToggleGroup(label,checked,onToggle,subs){const g=document.createElement('div');g.className='effect-group';const hdr=document.createElement('div');hdr.className='effect-header';hdr.innerHTML='<span class="effect-label">'+label+'</span>';const tgl=document.createElement('label');tgl.className='toggle';const inp=document.createElement('input');inp.type='checkbox';inp.checked=checked;const sl=document.createElement('span');sl.className='slider';inp.addEventListener('change',()=>onToggle(inp.checked));tgl.appendChild(inp);tgl.appendChild(sl);hdr.appendChild(tgl);g.appendChild(hdr);if(subs&&subs.length){const sub=document.createElement('div');sub.className='effect-sub';subs.forEach(sc=>{if(sc.type==='select'){const r=document.createElement('div');r.className='slider-row';r.innerHTML='<div class="slider-label">'+sc.label+'</div><div class="slider-wrap"></div>';const sel=document.createElement('select');sel.className='effect-select';sc.options.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(sc.value===v)o.selected=true;sel.appendChild(o);});sel.addEventListener('change',()=>sc.onChange(sel.value));r.querySelector('.slider-wrap').appendChild(sel);sub.appendChild(r);}else if(sc.type==='slider'){const r=document.createElement('div');r.className='slider-row';const lb=document.createElement('div');lb.className='slider-label';lb.textContent=sc.label;const wr=document.createElement('div');wr.className='slider-wrap';const i2=document.createElement('input');i2.type='range';i2.min=sc.min;i2.max=sc.max;i2.value=sc.value;if(sc.step)i2.step=sc.step;const vl=document.createElement('span');vl.className='slider-val';vl.textContent=sc.value+(sc.unit||'');updateFill(i2);i2.addEventListener('input',()=>{vl.textContent=i2.value+(sc.unit||'');updateFill(i2);sc.onChange(i2.value);});makeEditable(vl,i2,()=>parseFloat(i2.value),v=>{i2.value=v;updateFill(i2);sc.onChange(v);},sc.step,sc.unit||'');wr.appendChild(i2);r.appendChild(lb);r.appendChild(wr);r.appendChild(vl);sub.appendChild(r);}else if(sc.type==='color'){const r=document.createElement('div');r.className='slider-row';r.innerHTML='<div class="slider-label">'+sc.label+'</div><div class="slider-wrap"></div>';const ci=document.createElement('input');ci.type='color';ci.className='color-input';ci.value=sc.value;ci.addEventListener('input',()=>sc.onChange(ci.value));r.querySelector('.slider-wrap').appendChild(ci);sub.appendChild(r);}else if(sc.type==='toggle'){const r=document.createElement('div');r.className='effect-header';r.innerHTML='<span class="effect-label" style="font-size:12px">'+sc.label+'</span>';const tg=document.createElement('label');tg.className='toggle';const ti=document.createElement('input');ti.type='checkbox';ti.checked=sc.checked;const ts=document.createElement('span');ts.className='slider';ti.addEventListener('change',()=>sc.onChange(ti.checked));tg.appendChild(ti);tg.appendChild(ts);r.appendChild(tg);sub.appendChild(r);}else if(sc.type==='text'){const r=document.createElement('div');r.className='slider-row';r.innerHTML='<div class="slider-label">'+sc.label+'</div><div class="slider-wrap"></div>';const ti=document.createElement('input');ti.type='text';ti.className='effect-text-input';ti.value=sc.value;ti.addEventListener('input',()=>sc.onChange(ti.value));r.querySelector('.slider-wrap').appendChild(ti);sub.appendChild(r);}});g.appendChild(sub);}return g;}

  function makeSliderGroup(label,value,min,max,step,unit,onChange){const g=document.createElement('div');g.className='effect-group';const r=document.createElement('div');r.className='slider-row';const lb=document.createElement('div');lb.className='slider-label';lb.textContent=label;const wr=document.createElement('div');wr.className='slider-wrap';const inp=document.createElement('input');inp.type='range';inp.min=min;inp.max=max;inp.value=value;if(step)inp.step=step;const vl=document.createElement('span');vl.className='slider-val';vl.textContent=value+(unit||'');updateFill(inp);inp.addEventListener('input',()=>{vl.textContent=inp.value+(unit||'');updateFill(inp);onChange(inp.value);});makeEditable(vl,inp,()=>parseFloat(inp.value),v=>{inp.value=v;updateFill(inp);onChange(v);},step,unit||'');wr.appendChild(inp);r.appendChild(lb);r.appendChild(wr);r.appendChild(vl);g.appendChild(r);return g;}
  buildEffectsPanel();

  /* ── TABS ── */
  document.querySelectorAll('.tab-btn').forEach(btn=>{btn.addEventListener('click',()=>{activeTab=btn.dataset.tab;document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));btn.classList.add('active');$(btn.dataset.tab+'Tab').classList.add('active');updateBrushCursor();if(activeTab==='presets')renderPresetGrid();});});

  /* ── PRESET GRID ── */
  function renderPresetGrid(){presetsGrid.innerHTML='';const f=activeCategory==='all'?PRESETS:PRESETS.filter(p=>p.cat===activeCategory);f.forEach(pr=>{const gi=PRESETS.indexOf(pr);const item=document.createElement('div');item.className='preset-item'+(gi===activePresetIdx?' active':'');item.dataset.idx=gi;const thumb=document.createElement('div');thumb.className='preset-thumb';const c=document.createElement('canvas');c.width=80;c.height=80;thumb.appendChild(c);const name=document.createElement('div');name.className='preset-name';name.textContent=pr.name;item.appendChild(thumb);item.appendChild(name);item.addEventListener('click',()=>applyPreset(gi));presetsGrid.appendChild(item);const src=cameraActive?cameraThumbImage:currentImage;if(src)requestAnimationFrame(()=>renderToCanvas(c,src,pr,80));});}

  /* ── RENDERING ── */
  function initBuffers(){if(!currentImage)return;const r=Math.min(MAX_PREVIEW/currentImage.naturalWidth,MAX_PREVIEW/currentImage.naturalHeight,1);const w=Math.round(currentImage.naturalWidth*r),h=Math.round(currentImage.naturalHeight*r);if(!baseBuffer)baseBuffer=document.createElement('canvas');if(!strokeBuffer)strokeBuffer=document.createElement('canvas');if(!tempBuffer)tempBuffer=document.createElement('canvas');baseBuffer.width=w;baseBuffer.height=h;strokeBuffer.width=w;strokeBuffer.height=h;tempBuffer.width=w;tempBuffer.height=h;previewCanvas.width=w;previewCanvas.height=h;previewCanvas.style.width='';previewCanvas.style.height='';PhotoLab._previewDim={w,h};}
  function requestRender(){if(!renderPending&&currentImage){renderPending=true;requestAnimationFrame(()=>{renderPending=false;doRender();});}}
  function doRender(){if(!currentImage||isComparing)return;if(!baseBuffer)initBuffers();renderToCanvas(baseBuffer,currentImage,settings,0);compositePreview(previewCanvas,baseBuffer,strokeBuffer,effects,texts);}
  function deselectPreset(){if(activePresetIdx!==-1){activePresetIdx=-1;document.querySelectorAll('.preset-item').forEach(el=>el.classList.remove('active'));}}
  function applyPreset(idx){const pr=PRESETS[idx];if(!pr)return;activePresetIdx=idx;Object.keys(DEFAULTS).forEach(k=>{settings[k]=pr[k]!==undefined?pr[k]:DEFAULTS[k];});effects={...DEFAULT_EFFECTS};if(pr._fx)Object.keys(pr._fx).forEach(k=>{if(k in DEFAULT_EFFECTS)effects[k]=pr._fx[k];});SLIDERS.forEach(s=>{const i=$('sl_'+s.id),v=$('vl_'+s.id);i.value=settings[s.id];v.textContent=fmtVal(settings[s.id],s);updateFill(i);});document.querySelectorAll('.preset-item').forEach(el=>el.classList.toggle('active',+el.dataset.idx===idx));buildEffectsPanel();clearBrushStrokes();requestRender();}

  /* ── BRUSH ENGINE ── */
  function pushUndo(){if(!strokeBuffer)return;undoStack.push(strokeBuffer.getContext('2d').getImageData(0,0,strokeBuffer.width,strokeBuffer.height));if(undoStack.length>MAX_UNDO)undoStack.shift();}
  function undoBrush(){if(!undoStack.length||!strokeBuffer)return;strokeBuffer.getContext('2d').putImageData(undoStack.pop(),0,0);requestRender();showToast('Undo');}
  function clearBrushStrokes(){if(strokeBuffer)strokeBuffer.getContext('2d').clearRect(0,0,strokeBuffer.width,strokeBuffer.height);undoStack=[];if(currentImage&&!cameraActive)requestRender();}
  function paintAt(cx,cy){if(!strokeBuffer||!baseBuffer)return;const w=strokeBuffer.width,h=strokeBuffer.height;const sctx=strokeBuffer.getContext('2d');const r=Math.max(2,brushSize*(w/MAX_PREVIEW));const str=brushStrength/100;if(activeBrush==='blur'){const tctx=tempBuffer.getContext('2d');const blurAmount=Math.max(2,str*25);const pad=Math.ceil(blurAmount*1.5);const bx0=Math.max(0,Math.floor(cx-r-pad)),by0=Math.max(0,Math.floor(cy-r-pad));const bx1=Math.min(w,Math.ceil(cx+r+pad)),by1=Math.min(h,Math.ceil(cy+r+pad));const bw=Math.max(1,bx1-bx0),bh=Math.max(1,by1-by0);const factor=Math.max(0.02,1/blurAmount);const sw=Math.max(1,Math.round(bw*factor)),sh=Math.max(1,Math.round(bh*factor));const smallC=document.createElement('canvas');smallC.width=sw;smallC.height=sh;const smCtx=smallC.getContext('2d');smCtx.drawImage(baseBuffer,bx0,by0,bw,bh,0,0,sw,sh);smCtx.drawImage(strokeBuffer,bx0,by0,bw,bh,0,0,sw,sh);tctx.clearRect(0,0,w,h);tctx.imageSmoothingEnabled=true;tctx.imageSmoothingQuality='high';tctx.drawImage(smallC,0,0,sw,sh,bx0,by0,bw,bh);sctx.save();sctx.beginPath();sctx.arc(cx,cy,r,0,Math.PI*2);sctx.clip();sctx.drawImage(tempBuffer,bx0,by0,bw,bh,bx0,by0,bw,bh);sctx.restore();}else if(activeBrush==='erase'){sctx.save();sctx.beginPath();sctx.arc(cx,cy,r,0,Math.PI*2);sctx.clip();sctx.clearRect(0,0,w,h);sctx.restore();}}
  function paintStroke(x0,y0,x1,y1){const dx=x1-x0,dy=y1-y0,d=Math.sqrt(dx*dx+dy*dy),steps=Math.max(1,Math.floor(d/3));for(let i=0;i<=steps;i++){const t=i/steps;paintAt(x0+dx*t,y0+dy*t);}}
  function updateBrushCursor(){if(activeTab!=='tools'||cameraActive){previewArea.classList.remove('brush-active','no-brush-cursor');previewArea.style.cursor=zoom>1?'grab':'default';return;}previewArea.classList.add('brush-active');if(!appSettings.showBrushCursor){previewArea.classList.add('no-brush-cursor');previewArea.style.cursor='crosshair';return;}previewArea.classList.remove('no-brush-cursor');const displayW=previewCanvas.getBoundingClientRect().width;const sz=Math.max(8,Math.min(128,brushSize*(displayW/previewCanvas.width)));const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+sz+'" height="'+sz+'"><circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+(sz/2-1)+'" fill="none" stroke="white" stroke-width="1.5" opacity="0.8"/><circle cx="'+sz/2+'" cy="'+sz/2+'" r="1" fill="white" opacity="0.6"/></svg>';previewArea.style.cursor="url('data:image/svg+xml;base64,"+btoa(svg)+"') "+sz/2+" "+sz/2+", crosshair";}

  /* ── TEXT ── */
  function addText(){const id=++textIdCounter;texts.push({id,text:'Your text',x:previewCanvas.width*0.1,y:previewCanvas.height*0.1,fontSize:32,color:'#ffffff',fontFamily:'DM Sans',fontWeight:'600',opacity:100,textBlur:0,glow:false,glowColor:'#ffffff',glowIntensity:20,outline:false,outlineColor:'#000000',outlineWidth:2,letterSpacing:0});selectText(id);renderTextList();requestRender();}
  function selectText(id){selectedTextId=id;renderTextList();const t=texts.find(x=>x.id===id);if(!t){textProps.style.display='none';return;}textProps.style.display='block';textContent.value=t.text;textSize.value=t.fontSize;textSizeVal.textContent=t.fontSize;textColor.value=t.color;textFont.value=t.fontFamily;textOpacity.value=t.opacity;textOpacityVal.textContent=t.opacity+'%';updateFill(textOpacity);textBlur.value=t.textBlur;textBlurVal.textContent=t.textBlur;updateFill(textBlur);textGlow.checked=t.glow;textGlowSub.style.display=t.glow?'block':'none';textGlowColor.value=t.glowColor;textGlowIntensity.value=t.glowIntensity;textGlowIntensityVal.textContent=t.glowIntensity;updateFill(textGlowIntensity);textOutline.checked=t.outline;textOutlineSub.style.display=t.outline?'block':'none';textOutlineColor.value=t.outlineColor;textOutlineWidth.value=t.outlineWidth;textOutlineWidthVal.textContent=t.outlineWidth;updateFill(textOutlineWidth);textLetterSpacing.value=t.letterSpacing;textLetterSpacingVal.textContent=t.letterSpacing;updateFill(textLetterSpacing);}
  function deleteText(id){texts=texts.filter(x=>x.id!==id);if(selectedTextId===id){selectedTextId=null;textProps.style.display='none';}renderTextList();requestRender();}
  function renderTextList(){textList.innerHTML='';texts.forEach(t=>{const i=document.createElement('div');i.className='text-item'+(t.id===selectedTextId?' active':'');i.innerHTML='<span>'+(t.text||'Empty')+'</span><i class="fa-solid fa-grip-vertical" style="color:var(--muted);font-size:10px"></i>';i.addEventListener('click',()=>selectText(t.id));textList.appendChild(i);});}
  function getTextArea(t){const ctx=previewCanvas.getContext('2d'),sp=t.letterSpacing||0;let tw=0;ctx.font=(t.fontWeight||'600')+' '+t.fontSize+'px "'+t.fontFamily+'", sans-serif';if(sp===0){tw=ctx.measureText(t.text).width;}else{for(let i=0;i<t.text.length;i++){tw+=ctx.measureText(t.text[i]).width;if(i<t.text.length-1)tw+=sp;}}return{x:t.x-4,y:t.y-4,w:Math.max(tw+8,20),h:t.fontSize+10};}
  function hitTestText(cx,cy){for(let i=texts.length-1;i>=0;i--){const a=getTextArea(texts[i]);if(cx>=a.x&&cx<=a.x+a.w&&cy>=a.y&&cy<=a.y+a.h)return texts[i];}return null;}

  function txtVal(span,slider,prop,step,unit,suffix){
    makeEditable(span,slider,()=>{const t=texts.find(x=>x.id===selectedTextId);return t?t[prop]:0;},v=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t[prop]=v;requestRender();}},step,unit);
  }
  txtVal(textSizeVal,textSize,'fontSize',1,'');
  txtVal(textOpacityVal,textOpacity,'opacity',1,'%');
  txtVal(textBlurVal,textBlur,'textBlur',0.5,'');
  txtVal(textGlowIntensityVal,textGlowIntensity,'glowIntensity',1,'');
  txtVal(textOutlineWidthVal,textOutlineWidth,'outlineWidth',1,'');
  txtVal(textLetterSpacingVal,textLetterSpacing,'letterSpacing',1,'');

  /* Text slider input handlers (update span text on drag) */
  textSize.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.fontSize=+textSize.value;textSizeVal.textContent=textSize.value;requestRender();}});
  textOpacity.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.opacity=+textOpacity.value;textOpacityVal.textContent=textOpacity.value+'%';updateFill(textOpacity);requestRender();}});
  textBlur.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.textBlur=+textBlur.value;textBlurVal.textContent=textBlur.value;updateFill(textBlur);requestRender();}});
  textGlowIntensity.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.glowIntensity=+textGlowIntensity.value;textGlowIntensityVal.textContent=textGlowIntensity.value;updateFill(textGlowIntensity);requestRender();}});
  textOutlineWidth.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.outlineWidth=+textOutlineWidth.value;textOutlineWidthVal.textContent=textOutlineWidth.value;updateFill(textOutlineWidth);requestRender();}});
  textLetterSpacing.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.letterSpacing=+textLetterSpacing.value;textLetterSpacingVal.textContent=textLetterSpacing.value;updateFill(textLetterSpacing);requestRender();}});

  addTextBtn.addEventListener('click',addText);
  deleteTextBtn.addEventListener('click',()=>{if(selectedTextId)deleteText(selectedTextId);});
  textContent.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.text=textContent.value||' ';renderTextList();requestRender();}});
  textColor.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.color=textColor.value;requestRender();}});
  textFont.addEventListener('change',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.fontFamily=textFont.value;requestRender();}});
  textGlow.addEventListener('change',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.glow=textGlow.checked;textGlowSub.style.display=t.glow?'block':'none';requestRender();}});
  textGlowColor.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.glowColor=textGlowColor.value;requestRender();}});
  textOutline.addEventListener('change',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.outline=textOutline.checked;textOutlineSub.style.display=t.outline?'block':'none';requestRender();}});
  textOutlineColor.addEventListener('input',()=>{const t=texts.find(x=>x.id===selectedTextId);if(t){t.outlineColor=textOutlineColor.value;requestRender();}});

  /* ── ZOOM ── */
  function applyZoom(){imageFrame.style.transform='translate('+panX+'px,'+panY+'px) scale('+zoom+')';zoomLabel.textContent=Math.round(zoom*100)+'%';updateBrushCursor();if(zoom>1.03)showZoomPill();else{clearTimeout(zoomPillTimer);zoomPill.classList.remove('visible');}}
  function zoomTo(nz,cx,cy){const oz=zoom;nz=Math.max(0.25,Math.min(10,nz));if(cx!==undefined&&cy!==undefined){const r=imageFrame.getBoundingClientRect();const ix=cx-r.left-r.width/2,iy=cy-r.top-r.height/2;panX-=ix*(nz/oz-1);panY-=iy*(nz/oz-1);}zoom=nz;applyZoom();}
  zoomInBtn.addEventListener('click',()=>zoomTo(zoom*1.3));zoomOutBtn.addEventListener('click',()=>zoomTo(zoom/1.3));zoomFitBtn.addEventListener('click',()=>{zoom=1;panX=0;panY=0;applyZoom();});
  previewArea.addEventListener('wheel',e=>{e.preventDefault();zoomTo(zoom*(e.deltaY>0?0.9:1.1),e.clientX,e.clientY);},{passive:false});

  /* ── TOUCH ── */
  previewArea.addEventListener('touchstart',e=>{
    if(e.touches.length===2&&!cameraActive&&currentImage){pinchStartDist=getTouchDist(e);pinchStartZoom=zoom;isPinching=true;}
    if(e.touches.length===1&&activeTab==='tools'&&!cameraActive&&currentImage&&!isComparing){e.preventDefault();const t=e.touches[0];const{x,y}=screenToCanvas(t.clientX,t.clientY);isPainting=true;lastBrushX=x;lastBrushY=y;pushUndo();paintAt(x,y);compositePreview(previewCanvas,baseBuffer,strokeBuffer,effects,texts);}
    if(e.touches.length===1&&activeTab==='text'&&!cameraActive&&currentImage){const t=e.touches[0];const{x,y}=screenToCanvas(t.clientX,t.clientY);const hit=hitTestText(x,y);if(hit){isDraggingText=true;dragTextId=hit.id;dragOffX=x-hit.x;dragOffY=y-hit.y;selectText(hit.id);e.preventDefault();}else if(zoom>1){isPanning=true;panStartX=e.clientX-panX;panStartY=e.clientY-panY;previewArea.classList.add('panning');}}
    if(e.touches.length===1&&activeTab!=='tools'&&activeTab!=='text'&&!cameraActive&&currentImage&&zoom>1){isPanning=true;panStartX=e.clientX-panX;panStartY=e.clientY-panY;previewArea.classList.add('panning');}
  },{passive:false});
  previewArea.addEventListener('touchmove',e=>{
    if(e.touches.length===2&&isPinching){e.preventDefault();const d=getTouchDist(e),scale=d/pinchStartDist;zoomTo(pinchStartZoom*scale,(e.touches[0].clientX+e.touches[1].clientX)/2,(e.touches[0].clientY+e.touches[1].clientY)/2);}
    if(isPainting&&e.touches.length===1){e.preventDefault();const t=e.touches[0];const{x,y}=screenToCanvas(t.clientX,t.clientY);paintStroke(lastBrushX,lastBrushY,x,y);lastBrushX=x;lastBrushY=y;compositePreview(previewCanvas,baseBuffer,strokeBuffer,effects,texts);}
    if(isDraggingText&&e.touches.length===1){const t=e.touches[0];const{x,y}=screenToCanvas(t.clientX,t.clientY);const tx=texts.find(x=>x.id===dragTextId);if(tx){tx.x=x-dragOffX;tx.y=y-dragOffY;requestRender();}}
  },{passive:false});
  previewArea.addEventListener('touchend',e=>{if(e.touches.length<2){isPinching=false;pinchStartDist=0;}if(e.touches.length===0){if(isPainting){isPainting=false;lastBrushX=-1;lastBrushY=-1;}isDraggingText=false;dragTextId=null;const now=Date.now();if(now-lastTapTime<300&&Math.abs(zoom-1)>0.03){zoom=1;panX=0;panY=0;applyZoom();zoomPill.classList.remove('visible');clearTimeout(zoomPillTimer);}lastTapTime=now;}});

  /* ── THEME ── */
  nightBtn.addEventListener('click',()=>{document.body.classList.toggle('light-mode');const l=document.body.classList.contains('light-mode');nightBtn.innerHTML=l?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';nightBtn.title=l?'Switch to dark mode':'Switch to light mode';});

  /* ── COMPARE ── */
  function showOriginal(){if(!currentImage||cameraActive)return;isComparing=true;renderOriginal(previewCanvas,currentImage,MAX_PREVIEW);compareLabel.classList.add('show');}
  function showEdited(){if(!isComparing)return;isComparing=false;compareLabel.classList.remove('show');doRender();}
  compareBtn.addEventListener('mousedown',showOriginal);compareBtn.addEventListener('mouseup',showEdited);compareBtn.addEventListener('mouseleave',()=>{if(isComparing)showEdited();});
  compareBtn.addEventListener('touchstart',e=>{e.preventDefault();showOriginal();},{passive:false});compareBtn.addEventListener('touchend',showEdited);

  /* ── SAVE ── */
  async function saveToGallery(canvas,filename){
    const fmt=appSettings.exportFormat;const mime=fmt==='jpeg'?'image/jpeg':fmt==='webp'?'image/webp':'image/png';const q=fmt==='png'?undefined:appSettings.exportQuality/100;const ext=fmt==='jpeg'?'jpg':fmt;const fullName=filename.replace(/\.[^.]+$/,'')+'_edited.'+ext;
    try{const blob=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Blob failed')),mime,q));
    if(navigator.share&&navigator.canShare){try{const file=new File([blob],fullName,{type:mime});if(navigator.canShare({files:[file]})){await navigator.share({files:[file]},{title:fullName});showToast('Shared');downloadBtn.disabled=false;downloadBtn.innerHTML='<i class="fa-solid fa-download"></i><span class="btn-text">Save</span>';return;}}catch(e){if(e.name==='AbortError'){showToast('Cancelled');downloadBtn.disabled=false;downloadBtn.innerHTML='<i class="fa-solid fa-download"></i><span class="btn-text">Save</span>';return;}}}
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fullName;document.body.appendChild(a);a.click();setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);showToast('Saved '+ext.toUpperCase());
    }catch(err){console.error(err);showToast('Export failed');}
  }
  downloadBtn.addEventListener('click',()=>{if(!currentImage||cameraActive)return;downloadBtn.disabled=true;downloadBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span class="btn-text">...</span>';setTimeout(()=>{try{let fs=null;if(strokeBuffer&&strokeBuffer.width>0){fs=document.createElement('canvas');fs.width=currentImage.naturalWidth;fs.height=currentImage.naturalHeight;fs.getContext('2d').drawImage(strokeBuffer,0,0,fs.width,fs.height);}const c=renderExport(currentImage,settings,effects,texts,fs);saveToGallery(c,currentFileName);}catch(err){console.error(err);showToast('Export failed');downloadBtn.disabled=false;downloadBtn.innerHTML='<i class="fa-solid fa-download"></i><span class="btn-text">Save</span>';}},60);});

  /* ── RESET ── */
  function resetAll(){settings={...DEFAULTS};activePresetIdx=-1;effects={...DEFAULT_EFFECTS};texts=[];selectedTextId=null;textProps.style.display='none';renderTextList();SLIDERS.forEach(s=>{const i=$('sl_'+s.id),v=$('vl_'+s.id);i.value=s.def;v.textContent=fmtVal(s.def,s);updateFill(i);});document.querySelectorAll('.preset-item').forEach(el=>el.classList.remove('active'));clearBrushStrokes();buildEffectsPanel();if(!cameraActive)requestRender();showToast('Reset to original');}
  resetBtn.addEventListener('click',resetAll);undoBtn.addEventListener('click',undoBrush);

  /* ── SETTINGS ── */
  function openSettings(){settingsModal.classList.add('open');buildShortcutList();syncSettingsUI();}
  function closeSettingsModal(){settingsModal.classList.remove('open');rebindingId=null;}
  settingsBtn.addEventListener('click',openSettings);closeSettings.addEventListener('click',closeSettingsModal);settingsOverlay.addEventListener('click',closeSettingsModal);
  function syncSettingsUI(){settingBrushCursor.checked=appSettings.showBrushCursor;settingAutoFit.checked=appSettings.autoFit;settingSmoothZoom.checked=appSettings.smoothZoom;settingExportFormat.value=appSettings.exportFormat;settingExportQuality.value=appSettings.exportQuality;settingExportQualityVal.textContent=appSettings.exportQuality+'%';qualityRow.style.display=appSettings.exportFormat==='png'?'none':'flex';brushCursorToggle.checked=appSettings.showBrushCursor;}
  settingBrushCursor.addEventListener('change',()=>{appSettings.showBrushCursor=settingBrushCursor.checked;brushCursorToggle.checked=settingBrushCursor.checked;updateBrushCursor();});
  settingAutoFit.addEventListener('change',()=>{appSettings.autoFit=settingAutoFit.checked;});
  settingSmoothZoom.addEventListener('change',()=>{appSettings.smoothZoom=settingSmoothZoom.checked;document.body.classList.toggle('smooth-zoom',appSettings.smoothZoom);});
  settingExportFormat.addEventListener('change',()=>{appSettings.exportFormat=settingExportFormat.value;qualityRow.style.display=appSettings.exportFormat==='png'?'none':'flex';});
  settingExportQuality.addEventListener('input',()=>{appSettings.exportQuality=+settingExportQuality.value;settingExportQualityVal.textContent=settingExportQuality.value+'%';updateFill(settingExportQuality);});
  makeEditable(settingExportQualityVal,settingExportQuality,()=>appSettings.exportQuality,v=>{appSettings.exportQuality=v;},1,'%');
  updateFill(settingExportQuality);document.body.classList.add('smooth-zoom');

  /* ── KEYBOARD ── */
  function formatShortcut(sc){let p=[];if(sc.ctrl)p.push('Ctrl');if(sc.shift)p.push('Shift');if(sc.alt)p.push('Alt');let k=sc.key;if(sc.key===' ')k='Space';else if(sc.key.length===1)k=sc.key.toUpperCase();p.push(k);return p.join(' + ');}
  function buildShortcutList(){shortcutList.innerHTML='';shortcutMap.forEach(sc=>{const r=document.createElement('div');r.className='shortcut-row';const l=document.createElement('span');l.className='shortcut-label';l.textContent=sc.label;const k=document.createElement('span');k.className='shortcut-key';k.dataset.id=sc.id;k.textContent=rebindingId===sc.id?'Press key...':formatShortcut(sc);if(rebindingId===sc.id)k.classList.add('listening');k.addEventListener('click',e=>{e.stopPropagation();if(rebindingId===sc.id){rebindingId=null;buildShortcutList();return;}rebindingId=sc.id;buildShortcutList();});r.appendChild(l);r.appendChild(k);shortcutList.appendChild(r);});}
  function handleRebind(e){if(!rebindingId)return false;e.preventDefault();e.stopPropagation();const sc=shortcutMap.find(s=>s.id===rebindingId);if(sc){if(['Control','Shift','Alt','Meta'].includes(e.key))return false;sc.key=e.key;sc.ctrl=e.ctrlKey||e.metaKey;sc.shift=e.shiftKey;sc.alt=e.altKey;showToast(sc.label+' \u2192 '+formatShortcut(sc));}rebindingId=null;buildShortcutList();return true;}
  function matchShortcut(e){for(const sc of shortcutMap){if(sc.key===e.key&&sc.ctrl===(e.ctrlKey||e.metaKey)&&sc.shift===e.shiftKey&&sc.alt===e.altKey)return sc;}return null;}
  function executeShortcut(sc){switch(sc.id){case 'undo':undoBrush();break;case 'reset':if(currentImage&&editorScreen.classList.contains('visible'))resetAll();break;case 'zoomIn':zoomTo(zoom*1.2);break;case 'zoomOut':zoomTo(zoom/1.2);break;case 'zoomFit':zoomFitBtn.click();break;case 'compare':if(currentImage&&!cameraActive&&!isComparing)showOriginal();break;case 'newImage':fileInput.click();break;case 'download':if(currentImage&&!cameraActive)downloadBtn.click();break;case 'settings':openSettings();break;}}
  document.addEventListener('keydown',e=>{if(handleRebind(e))return;if(document.activeElement&&'INPUT TEXTAREA SELECT'.includes(document.activeElement.tagName))return;const sc=matchShortcut(e);if(sc){e.preventDefault();executeShortcut(sc);}});
  document.addEventListener('keyup',e=>{const _sc=matchShortcut(e);if(_sc&&_sc.id==='compare'&&isComparing)showEdited();});

  /* ── FILE UPLOAD ── */
  function handleFile(file){if(!file||!file.type.startsWith('image/')){showToast('Select a valid image');return;}currentFileName=file.name;const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{currentImage=img;baseBuffer=null;strokeBuffer=null;tempBuffer=null;undoStack=[];if(cameraActive)stopCameraStream();resetAll();uploadScreen.classList.add('hidden');editorScreen.classList.add('visible');if(appSettings.autoFit){zoom=1;panX=0;panY=0;applyZoom();}updateBrushCursor();updateSizeBadge();setTimeout(()=>renderPresetGrid(),120);};img.src=e.target.result;};reader.readAsDataURL(file);}
  browseBtn.addEventListener('click',e=>{e.stopPropagation();fileInput.click();});
  uploadZone.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{if(fileInput.files.length)handleFile(fileInput.files[0]);fileInput.value='';});
  uploadZone.addEventListener('dragover',e=>{e.preventDefault();uploadZone.classList.add('dragover');});
  uploadZone.addEventListener('dragleave',()=>uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop',e=>{e.preventDefault();uploadZone.classList.remove('dragover');if(e.dataTransfer.files.length)handleFile(e.dataTransfer.files[0]);});
  document.body.addEventListener('dragover',e=>e.preventDefault());
  document.body.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))handleFile(f);});
  document.addEventListener('paste',e=>{if(rebindingId)return;if(document.activeElement&&'INPUT TEXTAREA SELECT'.includes(document.activeElement.tagName))return;const items=e.clipboardData&&e.clipboardData.items;if(!items)return;for(const it of items){if(it.type.startsWith('image/')){handleFile(it.getAsFile());break;}}});
  newBtn.addEventListener('click',()=>fileInput.click());

  /* ── MOUSE ── */
  previewArea.addEventListener('mousedown',e=>{if(!currentImage||isComparing||cameraActive)return;if(e.target!==previewCanvas&&e.target!==imageFrame&&!imageFrame.contains(e.target))return;const{x,y}=screenToCanvas(e.clientX,e.clientY);if(activeTab==='tools'){isPainting=true;lastBrushX=x;lastBrushY=y;pushUndo();paintAt(x,y);compositePreview(previewCanvas,baseBuffer,strokeBuffer,effects,texts);}else if(activeTab==='text'){const hit=hitTestText(x,y);if(hit){isDraggingText=true;dragTextId=hit.id;dragOffX=x-hit.x;dragOffY=y-hit.y;selectText(hit.id);e.preventDefault();}else if(zoom>1){isPanning=true;panStartX=e.clientX-panX;panStartY=e.clientY-panY;previewArea.classList.add('panning');}}else{if(zoom>1){isPanning=true;panStartX=e.clientX-panX;panStartY=e.clientY-panY;previewArea.classList.add('panning');}}});
  window.addEventListener('mousemove',e=>{if(isPainting&&currentImage){const{x,y}=screenToCanvas(e.clientX,e.clientY);paintStroke(lastBrushX,lastBrushY,x,y);lastBrushX=x;lastBrushY=y;compositePreview(previewCanvas,baseBuffer,strokeBuffer,effects,texts);}if(isDraggingText){const{x,y}=screenToCanvas(e.clientX,e.clientY);const t=texts.find(x=>x.id===dragTextId);if(t){t.x=x-dragOffX;t.y=y-dragOffY;requestRender();}}if(isPanning){panX=e.clientX-panStartX;panY=e.clientY-panStartY;applyZoom();}});
  window.addEventListener('mouseup',()=>{if(isPainting){isPainting=false;lastBrushX=-1;lastBrushY=-1;}isDraggingText=false;dragTextId=null;if(isPanning){isPanning=false;previewArea.classList.remove('panning');}});

  window.addEventListener('resize',()=>{if(currentImage&&!cameraActive){fitCanvasCSS();}if(cameraActive){updateCameraCrop();}});
})();

(function(){
  var ed=document.getElementById('editorScreen');
  var bp=document.querySelector('.bottom-panel');
  if(!ed||!bp)return;
  function fix(){
    if(!ed.classList.contains('visible'))return;
    if(window.visualViewport){
      ed.style.height=window.visualViewport.height+'px';
      var gap=window.innerHeight-window.visualViewport.height;
      if(gap>2){bp.style.paddingBottom=gap+'px';bp.style.boxSizing='border-box';}
      else{bp.style.paddingBottom='';}
    }
  }
  setTimeout(fix,0);setTimeout(fix,100);setTimeout(fix,500);setTimeout(fix,2000);
  if(window.visualViewport){window.visualViewport.addEventListener('resize',fix);window.visualViewport.addEventListener('scroll',fix);}
  window.addEventListener('resize',fix);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(fix,200);});
})();
