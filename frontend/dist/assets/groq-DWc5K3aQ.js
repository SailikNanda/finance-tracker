import{i as Y,k as U}from"./index-CvsyWean.js";const E="https://api.groq.com/openai/v1/chat/completions",g=["qwen/qwen3.8-27b"],C=15e3,z=8e3,H=30*60*1e3,O=new Map,F=new Map,b="ft_groq_api_key";let p=g[0];const w=()=>p,x={reasoning_effort:"none",reasoning_format:"hidden"};function A(t,e={},n=C){const a=new AbortController,s=setTimeout(()=>a.abort(),n),i={...e,signal:a.signal};return fetch(t,i).finally(()=>clearTimeout(s))}function q(t,e){const n=t.get(e);return n&&Date.now()-n.ts<H?n.data:(n&&t.delete(e),null)}function L(t,e,n){if(t.set(e,{data:n,ts:Date.now()}),t.size>20){const a=t.keys().next().value;t.delete(a)}}function G(t){return String(t||"").replace(/[\s\u200B-\u200D\uFEFF]/g,"").trim()}function S(){try{return G(localStorage.getItem(b)||"")}catch(t){return""}}function V(t){try{const e=G(t);e?localStorage.setItem(b,e):localStorage.removeItem(b)}catch(e){}}function T(){return!!S()}async function Z(){var e;const t=S();if(!t)return{ok:!1,message:"No Groq key saved."};try{const n=await A(E,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({model:w(),messages:[{role:"user",content:"Reply with one short word: ok"}],max_completion_tokens:10,temperature:0,...x})},1e4);return n.status===401?{ok:!1,message:"Invalid Groq key (401)."}:n.status===429?{ok:!1,message:"Rate limited. Try again later."}:n.status===402?{ok:!1,message:"Groq credits exhausted."}:n.ok?{ok:!0,message:"Connected. AI ready."}:{ok:!1,message:((e=(await n.json().catch(()=>({}))).error)==null?void 0:e.message)||`HTTP ${n.status}`}}catch(n){return n.name==="TypeError"?{ok:!1,message:"No internet. Check your connection."}:{ok:!1,message:n.message||"Connection failed"}}}async function v(t,e){var d,r,l;const n=S();if(!n)throw new Error("Add a Groq API key in Settings to unlock live AI.");const a=e?{model:w(),messages:e,temperature:.5,max_completion_tokens:2048,...x}:{model:w(),messages:[{role:"user",content:t}],temperature:.7,max_completion_tokens:2048,...x};let s;try{s=await A(E,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify(a)},C)}catch(h){throw h.name==="AbortError"?new Error("Groq timed out (15s). Try again."):h.name==="TypeError"?new Error("No internet. Check your connection."):new Error("Network error: "+(h.message||"unknown"))}if(s.status===401)throw new Error("Groq rejected the key (401). Update it in Settings.");if(s.status===429)throw new Error("Groq rate-limited. Try again in a moment.");if(s.status===402)throw new Error("Groq credits exhausted.");if(!s.ok){const y=((d=(await s.json().catch(()=>({}))).error)==null?void 0:d.message)||`Groq HTTP ${s.status}`,I=new Error(y);throw I.status=s.status,I}const c=((l=(r=(await s.json()).choices)==null?void 0:r[0])==null?void 0:l.message)||{},m=String(c.content||"").trim();if(!m)throw new Error("The AI returned an empty response. Please try again.");let o=$(m);const f=o.search(/final\s+answer\s*[:∩╝Ü]/i);return f>0&&(o=o.slice(f).replace(/final\s+answer\s*[:∩╝Ü]/i,"")),/^\s*(Okay|Alright|Ok|Sure|Hmm|Well|Let me|I need|I should|I must|I will|First|The user|Looking at|Based on|To answer|To provide|My approach|Step\s*\d)/i.test(o)&&(o=$(o)),o.trim()}function $(t){let e=String(t);const n=e.replace(/[\s\S]*?<\/think>\s*/i,"");n.trim().length>20&&(e=n),e=e.replace(/<think>[\s\S]*?<\/think>/gi,""),e=e.replace(/<thinking>[\s\S]*?<\/thinking>/gi,""),e=e.replace(/<\/?think>/gi,""),e=e.replace(/```thinking[\s\S]*?```/gi,""),e=e.replace(/```\s*think[\s\S]*?```/gi,""),e=e.replace(/^Here'?s?\s+a\s+thinking\s+process[\s\S]*$/im,""),e=e.replace(/^thinking:\s*[\s\S]*?\n{2,}/im,"");const a=[/^\s*(Okay|Alright|Ok|Sure|Hmm|Well|Let's see|Now)[\s,\.]+.{0,20}?\n{2,}/im,/^\s*Let me\s+(think|consider|analyze|break down|review|examine|look at|go through|work through|reason through|process|start|begin|outline|structure|organize|plan|calculate|compute|determine|evaluate|assess|examine|compare|estimate|measure|figure out|work on|think about|look into|check|verify|validate|confirm|double.check)[\s\S]*?\n{2,}/im,/^\s*First[\s,]+I\s+(need|should|must|will|have to|ought to)\s+[\s\S]*?\n{2,}/im,/^\s*(I need to|I should|I must|I will|I'll|My approach|My plan|My strategy|To answer|To respond|To address|To provide|To give|To generate|To create|To write|To produce|To draft|To prepare|To formulate|To draft)[\s\S]*?\n{2,}/im,/^\s*(The user|The question|Looking at|Based on|From the|Considering|Given the|Reviewing|Analyzing|Examining|Assessing|Evaluating)[\s\S]*?\n{2,}/im,/^\s*(Step\s*\d|Phase\s*\d|Part\s*\d)[\s\S]*?\n{2,}/im,/^\s*(To|For|In|On|At|With|From|By|As)[\s]+(?:this|the|a|an|my|your|our)\s+(?:question|request|query|problem|task|prompt|input)[\s\S]*?\n{2,}/im];for(const c of a)e=e.replace(c,"");const s=e.split(`
`);let i=0;for(let c=0;c<s.length;c++){const m=s[c].trim();if(!m){i=c+1;continue}if(/^(Okay|Alright|Ok|Sure|Hmm|Well|Let me|I need|I should|I must|I will|First|The user|Looking at|Based on|To |For |In |On |Step|Phase|Part)\b/i.test(m)){i=c+1;continue}break}return i>0&&(e=s.slice(i).join(`
`)),e=e.replace(/\n{3,}/g,`

`).trim(),e}async function _(t){try{return await v(t,null)}catch(e){if((e.status===404||e.status===400||/model/i.test(e.message||"")||/not found/i.test(e.message||""))&&p!==g[g.length-1]){const a=g.indexOf(p);p=g[a+1];try{return await v(t,null)}catch(s){throw p=g[0],s}}throw e}}async function W(t){try{return await v(null,t)}catch(e){if((e.status===404||e.status===400||/model/i.test(e.message||"")||/not found/i.test(e.message||""))&&p!==g[g.length-1]){const a=g.indexOf(p);p=g[a+1];try{return await v(null,t)}catch(s){throw p=g[0],s}}throw e}}const M=`MONTHLY FINANCIAL REPORT

Overview
Track your spending patterns to identify areas where small adjustments can compound into meaningful savings.

Spending Analysis
Categorize your expenses into needs, wants, and savings to maintain a balanced financial lifestyle.

Action Items
- Review recurring subscriptions and cancel any that are unused.
- Set up an automatic monthly transfer to a savings account.
- Look for opportunities to reduce discretionary spending.

Outlook
Consistent, small changes to spending habits lead to significant long-term financial growth.

Add a free Groq API key in Settings to receive a personalized AI report based on your transaction data.`,J=`PERSONALIZED SAVINGS PLAN

Framework
Apply the 50/30/20 rule as a starting point: 50% for needs, 30% for wants, 20% for savings and debt repayment.

Action Items
- Record every expense, no matter how small, to maintain awareness of cash flow.
- Build an emergency fund covering three to six months of essential expenses.
- Audit subscriptions quarterly and cancel services that no longer provide value.
- Use cashback or rewards programs for routine purchases.
- Review category-level spending each month to spot trends early.

Outlook
Disciplined tracking and incremental savings create a strong financial base over time.

Add a free Groq API key in Settings to receive a tailored savings plan based on your data.`;function R(t){return t.toLowerCase().includes("overview")?M:J}function D(t){return t&&String(t).replace(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2700}-\u{27BF}\u{FE0F}]/gu,"").replace(/ {2,}/g," ").replace(/\n{3,}/g,`

`).trim()}const N=["","January","February","March","April","May","June","July","August","September","October","November","December"];async function X(t,e,n,a){var r;const s=`ins:${n}:${a}:${t.income}:${t.expense}:${JSON.stringify(t.categories)}:${e.income}:${e.expense}:${T()?w():"nokey"}`,i=q(O,s);if(i)return i;const c=Object.entries(t.categories||{}).map(([l,h])=>`• ${l}: ${Number(h).toFixed(2)}`).join(`
`)||"No expenses recorded yet",m=`You are a professional financial advisor. Write a concise monthly financial report for ${N[n]} ${a} based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. CRITICAL: Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", "Step 1", or any preamble. Output ONLY the final formatted report starting directly with the section headings below. Format as plain text with these sections:

OVERVIEW
- One short paragraph summarizing the month's financial position.

SPENDING ANALYSIS
- Two to three short observations about the spending pattern.
- Compare to the previous month only if previous data is non-zero.

CATEGORY BREAKDOWN
- For each non-zero category in the data, one line: "Category: amount ΓÇö brief comment."

RECOMMENDATIONS
- Three specific, realistic actions to improve next month. Start each line with a dash.

OUTLOOK
- One sentence on what to watch for next month.

Data:
Current month ΓÇö Income: ${t.income.toFixed(2)}, Expenses: ${t.expense.toFixed(2)}, Balance: ${(t.income-t.expense).toFixed(2)}.
Categories: ${c}
Previous month ΓÇö Income: ${e.income.toFixed(2)}, Expenses: ${e.expense.toFixed(2)}.

Keep total response under 350 words.`;let o;try{o=await _(m)}catch(l){o=R(m),console.warn("Groq fallback:",l.message)}o=D(o);const f=((r=Object.entries(t.categories||{}).sort((l,h)=>h[1]-l[1])[0])==null?void 0:r[0])||"N/A",d={month:N[n],year:a,insights:o,highlights:{income:t.income,expenses:t.expense,savings:t.income-t.expense,top_category:f},ai_configured:T(),provider:"groq",model:T()?w():""};return L(O,s,d),d}async function ee(t){const e=`sug:${JSON.stringify(t)}:${T()?w():"nokey"}`,n=q(F,e);if(n)return n;const a=t.map(o=>`• Month ${o.month}/${o.year}: Income ${o.income.toFixed(2)}, Expenses ${o.expense.toFixed(2)}, Saved ${(o.income-o.expense).toFixed(2)}`).join(`
`),s=`You are a professional financial advisor. Write a personalized savings plan based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. CRITICAL: Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", "Step 1", or any preamble. Output ONLY the final formatted plan starting directly with the section headings below. Format as plain text with these sections:

TREND ANALYSIS
- Two to three short observations about the income and expense trends.

WATCH LIST
- Up to three categories or months that warrant attention.

SAVINGS STRATEGY
- Five specific, realistic actions to improve the savings rate. Each on its own line starting with a dash.

TARGETS
- A suggested monthly savings amount and savings-rate range.

RISK INDICATORS
- One or two early warning signs to monitor.

Data over ${t.length} months:
${a}

Keep total response under 350 words.`;let i;try{i=await _(s)}catch(o){i=R(s),console.warn("Groq fallback:",o.message)}i=D(i);const c=o=>o.length?o.reduce((f,d)=>f+d,0)/o.length:0,m={suggestions:i,analysis_period:`${t.length} months`,average_income:c(t.map(o=>o.income)),average_expense:c(t.map(o=>o.expense)),ai_configured:T(),provider:"groq",model:T()?w():""};return L(F,e,m),m}async function te(t){var d;if(!S())throw new Error("Add a Groq API key in Settings to use the Chatbot.");const n=((d=[...t].reverse().find(r=>r.role==="user"))==null?void 0:d.content)||"";let a="";try{const r=await Y();if(r&&r.length){const l=r.slice(0,100),h=l.filter(u=>u.amount>0).reduce((u,k)=>u+Number(k.amount),0),y=l.filter(u=>u.amount<0).reduce((u,k)=>u+Math.abs(Number(k.amount)),0),I=l.map(u=>{const k=new Date(u.date),j=isNaN(k.getTime())?String(u.date).slice(0,16):k.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),K=`${u.type==="income"?"+":"-"}${Math.abs(Number(u.amount)).toFixed(2)} ${u.currency||"INR"}`,P=String(u.name||"").replace(/[\r\n[\]<>]/g," ").slice(0,100).trim(),B=String(u.category||"").replace(/[\r\n[\]<>]/g," ").slice(0,50).trim();return`${j} | ${u.type} | ${B} | ${P} | ${K}`}).join(`
`);a=`[User's Local Transaction Diary - ${r.length} total records, showing last ${l.length}]:
Summary of shown: Income ${h.toFixed(2)}, Expense ${y.toFixed(2)}, Balance ${(h-y).toFixed(2)}
`+I+`
Instruction: Use this diary to answer any question about dates, amounts, categories, where/when/how much. If user asks "5 Sep koto khoroch", filter by that date. Keep data local, never hallucinate. If no matching record, say "Ei tarikhe kono record nei".`}else a="[User's Local Transaction Diary: No transactions yet. User has not saved any income/expense.]"}catch(r){console.warn("Diary fetch failed:",r),a=`[Diary fetch error: ${r.message}]`}const s=`You are a professional Financial & Banking Assistant with access to the user's LOCAL transaction diary.
Your instructions:
1. You must ONLY answer questions related to finance, banking, currency exchange, savings, investments, tax, loans, stock markets, card offers, general economy, AND the user's own transaction diary.
2. You HAVE the user's full diary below. When user asks "koto taka, kobe, kothay, kon category, kon tarikhe" - answer precisely from the diary. Quote date, name, amount, category. Do NOT hallucinate. If diary has no matching record, clearly say you don't have it.
3. If the user asks about coding, programming, web development, general trivia, math (unrelated to finance), science, history, translation (outside finance/diary), politely refuse.
4. You can converse in any language the user speaks (Bengali, English, Hindi). Match user's language.
5. If the user's query requires current real-time financial information (like interest rates, stock prices, exchange rates, banking news, today's rates), utilize the provided search context. If no search context is provided or it doesn't answer, state you don't have real-time access.
6. Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", or any preamble. Output ONLY the final answer starting directly with the information requested.
7. For greetings (hi, hello, hey), reply briefly and offer to help with diary or finance questions.
8. Keep answers concise, practical, and highly professional. Use simple formatting, no excessive emojis.
`,i=/rate|interest|current|today|latest|stock|price|news|bank|sbi|hdfc|icici|offer|loan|mortgage|market|yield|fd|rd|crypto|gold/i.test(n);let c="";const m=U();if(i&&m){const r=n.replace(/\b\d{4,}\b/g,"").replace(/(?:rs\.?|inr|\$|usd|taka)\s*[\d,]+(?:\.\d+)?/gi,"").replace(/[\r\n]+/g," ").trim();try{const l=await A("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:m,query:`finance banking: ${r||"current banking rates"}`,search_depth:"basic",include_answer:!0,max_results:3,topic:"finance"})},z);if(l.ok){const h=await l.json();c=`[Search Results from Internet]:
${h.answer||""}

`,h.results&&(c+=h.results.map(y=>`- ${y.title}: ${y.content}`).join(`
`))}}catch(l){console.warn("Tavily search failed for chat:",l)}}const o=[a,c].filter(Boolean).join(`

`),f=[{role:"system",content:s},...t.map(r=>r.role==="user"&&r.content===n&&o?{role:"user",content:`${o}

User Question: ${r.content}`}:r)];return W(f)}export{ee as a,S as b,te as c,X as g,T as h,V as s,Z as t};
