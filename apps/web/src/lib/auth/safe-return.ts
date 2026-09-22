export function safeReturnPath(value:string|null){if(!value)return'/';try{const d=decodeURIComponent(value);return d.startsWith('/')&&!d.startsWith('//')&&!d.includes('\\')?d:'/'}catch{return'/'}}
