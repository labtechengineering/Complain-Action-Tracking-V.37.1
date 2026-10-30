// Change only this value for the public application version.
(()=>{'use strict';
 const version='2.0.0';
 window.QA_RELEASE=Object.freeze({version,label:'Version '+version});
 const display=()=>document.querySelectorAll('[data-qa-version]').forEach(node=>{node.textContent=window.QA_RELEASE.label;});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',display,{once:true});else display();
})();
