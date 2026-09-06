import{k as R}from"./index-CcevYCpU.js";const F="https://api.groq.com/openai/v1/chat/completions",g=["qwen/qwen3.8-27b"],E=15e3,P=8e3,K=30*60*1e3,A=new Map,x=new Map,T="ft_groq_api_key";let h=g[0];const f=()=>h,v={reasoning_effort:"none",reasoning_format:"hidden"};function I(t,e={},n=E){const a=new AbortController,o=setTimeout(()=>a.abort(),n),r={...e,signal:a.signal};return fetch(t,r).finally(()=>clearTimeout(o))}function q(t,e){const n=t.get(e);return n&&Date.now()-n.ts<K?n.data:(n&&t.delete(e),null)}function N(t,e,n){if(t.set(e,{data:n,ts:Date.now()}),t.size>20){const a=t.keys().next().value;t.delete(a)}}function C(t){return String(t||"").replace(/[\s\u200B-\u200D\uFEFF]/g,"").trim()}function k(){try{return C(localStorage.getItem(T)||"")}catch(t){return""}}function z(t){try{const e=C(t);e?localStorage.setItem(T,e):localStorage.removeItem(T)}catch(e){}}function y(){return!!k()}async function H(){var e;const t=k();if(!t)return{ok:!1,message:"No Groq key saved."};try{const n=await I(F,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({model:f(),messages:[{role:"user",content:"Reply with one short word: ok"}],max_completion_tokens:10,temperature:0,...v})},1e4);return n.status===401?{ok:!1,message:"Invalid Groq key (401)."}:n.status===429?{ok:!1,message:"Rate limited. Try again later."}:n.status===402?{ok:!1,message:"Groq credits exhausted."}:n.ok?{ok:!0,message:"Connected. AI ready."}:{ok:!1,message:((e=(await n.json().catch(()=>({}))).error)==null?void 0:e.message)||`HTTP ${n.status}`}}catch(n){return n.name==="TypeError"?{ok:!1,message:"No internet. Check your connection."}:{ok:!1,message:n.message||"Connection failed"}}}async function w(t,e){var u,m,d;const n=k();if(!n)throw new Error("Add a Groq API key in Settings to unlock live AI.");const a=e?{model:f(),messages:e,temperature:.5,max_completion_tokens:2048,...v}:{model:f(),messages:[{role:"user",content:t}],temperature:.7,max_completion_tokens:2048,...v};let o;try{o=await I(F,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify(a)},E)}catch(p){throw p.name==="AbortError"?new Error("Groq timed out (15s). Try again."):p.name==="TypeError"?new Error("No internet. Check your connection."):new Error("Network error: "+(p.message||"unknown"))}if(o.status===401)throw new Error("Groq rejected the key (401). Update it in Settings.");if(o.status===429)throw new Error("Groq rate-limited. Try again in a moment.");if(o.status===402)throw new Error("Groq credits exhausted.");if(!o.ok){const _=((u=(await o.json().catch(()=>({}))).error)==null?void 0:u.message)||`Groq HTTP ${o.status}`,S=new Error(_);throw S.status=o.status,S}const c=((d=(m=(await o.json()).choices)==null?void 0:m[0])==null?void 0:d.message)||{},l=String(c.content||"").trim();if(!l)throw new Error("The AI returned an empty response. Please try again.");let s=b(l);const i=s.search(/final\s+answer\s*[:∩╝Ü]/i);return i>0&&(s=s.slice(i).replace(/final\s+answer\s*[:∩╝Ü]/i,"")),/^\s*(Okay|Alright|Ok|Sure|Hmm|Well|Let me|I need|I should|I must|I will|First|The user|Looking at|Based on|To answer|To provide|My approach|Step\s*\d)/i.test(s)&&(s=b(s)),s.trim()}function b(t){let e=String(t);const n=e.replace(/[\s\S]*?<\/think>\s*/i,"");n.trim().length>20&&(e=n),e=e.replace(/<think>[\s\S]*?<\/think>/gi,""),e=e.replace(/<thinking>[\s\S]*?<\/thinking>/gi,""),e=e.replace(/<\/?think>/gi,""),e=e.replace(/```thinking[\s\S]*?```/gi,""),e=e.replace(/```\s*think[\s\S]*?```/gi,""),e=e.replace(/^Here'?s?\s+a\s+thinking\s+process[\s\S]*$/im,""),e=e.replace(/^thinking:\s*[\s\S]*?\n{2,}/im,"");const a=[/^\s*(Okay|Alright|Ok|Sure|Hmm|Well|Let's see|Now)[\s,\.]+.{0,20}?\n{2,}/im,/^\s*Let me\s+(think|consider|analyze|break down|review|examine|look at|go through|work through|reason through|process|start|begin|outline|structure|organize|plan|calculate|compute|determine|evaluate|assess|examine|compare|estimate|measure|figure out|work on|think about|look into|check|verify|validate|confirm|double.check)[\s\S]*?\n{2,}/im,/^\s*First[\s,]+I\s+(need|should|must|will|have to|ought to)\s+[\s\S]*?\n{2,}/im,/^\s*(I need to|I should|I must|I will|I'll|My approach|My plan|My strategy|To answer|To respond|To address|To provide|To give|To generate|To create|To write|To produce|To draft|To prepare|To formulate|To draft)[\s\S]*?\n{2,}/im,/^\s*(The user|The question|Looking at|Based on|From the|Considering|Given the|Reviewing|Analyzing|Examining|Assessing|Evaluating)[\s\S]*?\n{2,}/im,/^\s*(Step\s*\d|Phase\s*\d|Part\s*\d)[\s\S]*?\n{2,}/im,/^\s*(To|For|In|On|At|With|From|By|As)[\s]+(?:this|the|a|an|my|your|our)\s+(?:question|request|query|problem|task|prompt|input)[\s\S]*?\n{2,}/im];for(const c of a)e=e.replace(c,"");const o=e.split(`
`);let r=0;for(let c=0;c<o.length;c++){const l=o[c].trim();if(!l){r=c+1;continue}if(/^(Okay|Alright|Ok|Sure|Hmm|Well|Let me|I need|I should|I must|I will|First|The user|Looking at|Based on|To |For |In |On |Step|Phase|Part)\b/i.test(l)){r=c+1;continue}break}return r>0&&(e=o.slice(r).join(`
`)),e=e.replace(/\n{3,}/g,`

`).trim(),e}async function $(t){try{return await w(t,null)}catch(e){if((e.status===404||e.status===400||/model/i.test(e.message||"")||/not found/i.test(e.message||""))&&h!==g[g.length-1]){const a=g.indexOf(h);h=g[a+1];try{return await w(t,null)}catch(o){throw h=g[0],o}}throw e}}async function j(t){try{return await w(null,t)}catch(e){if((e.status===404||e.status===400||/model/i.test(e.message||"")||/not found/i.test(e.message||""))&&h!==g[g.length-1]){const a=g.indexOf(h);h=g[a+1];try{return await w(null,t)}catch(o){throw h=g[0],o}}throw e}}const Y=`MONTHLY FINANCIAL REPORT

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

Add a free Groq API key in Settings to receive a personalized AI report based on your transaction data.`,D=`PERSONALIZED SAVINGS PLAN

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

Add a free Groq API key in Settings to receive a tailored savings plan based on your data.`;function L(t){return t.toLowerCase().includes("overview")?Y:D}function G(t){return t&&String(t).replace(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2700}-\u{27BF}\u{FE0F}]/gu,"").replace(/ {2,}/g," ").replace(/\n{3,}/g,`

`).trim()}const O=["","January","February","March","April","May","June","July","August","September","October","November","December"];async function U(t,e,n,a){var m;const o=`ins:${n}:${a}:${t.income}:${t.expense}:${JSON.stringify(t.categories)}:${e.income}:${e.expense}:${y()?f():"nokey"}`,r=q(A,o);if(r)return r;const c=Object.entries(t.categories||{}).map(([d,p])=>`• ${d}: ${Number(p).toFixed(2)}`).join(`
`)||"No expenses recorded yet",l=`You are a professional financial advisor. Write a concise monthly financial report for ${O[n]} ${a} based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. CRITICAL: Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", "Step 1", or any preamble. Output ONLY the final formatted report starting directly with the section headings below. Format as plain text with these sections:

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

Keep total response under 350 words.`;let s;try{s=await $(l)}catch(d){s=L(l),console.warn("Groq fallback:",d.message)}s=G(s);const i=((m=Object.entries(t.categories||{}).sort((d,p)=>p[1]-d[1])[0])==null?void 0:m[0])||"N/A",u={month:O[n],year:a,insights:s,highlights:{income:t.income,expenses:t.expense,savings:t.income-t.expense,top_category:i},ai_configured:y(),provider:"groq",model:y()?f():""};return N(A,o,u),u}async function W(t){const e=`sug:${JSON.stringify(t)}:${y()?f():"nokey"}`,n=q(x,e);if(n)return n;const a=t.map(s=>`• Month ${s.month}/${s.year}: Income ${s.income.toFixed(2)}, Expenses ${s.expense.toFixed(2)}, Saved ${(s.income-s.expense).toFixed(2)}`).join(`
`),o=`You are a professional financial advisor. Write a personalized savings plan based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. CRITICAL: Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", "Step 1", or any preamble. Output ONLY the final formatted plan starting directly with the section headings below. Format as plain text with these sections:

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

Keep total response under 350 words.`;let r;try{r=await $(o)}catch(s){r=L(o),console.warn("Groq fallback:",s.message)}r=G(r);const c=s=>s.length?s.reduce((i,u)=>i+u,0)/s.length:0,l={suggestions:r,analysis_period:`${t.length} months`,average_income:c(t.map(s=>s.income)),average_expense:c(t.map(s=>s.expense)),ai_configured:y(),provider:"groq",model:y()?f():""};return N(x,e,l),l}async function J(t){var s;if(!k())throw new Error("Add a Groq API key in Settings to use the Chatbot.");const n=((s=[...t].reverse().find(i=>i.role==="user"))==null?void 0:s.content)||"",a=`You are a professional Financial & Banking Assistant. 
Your instructions:
1. You must ONLY answer questions related to finance, banking, currency exchange, savings, investments, tax, loans, stock markets, card offers, and general economy.
2. If the user asks about coding, programming, web development, general trivia, math (unrelated to finance), science, history, translation (outside finance), or anything else outside finance, politely refuse to answer. You are NOT allowed to answer coding questions or other non-financial questions under any circumstances.
3. You can converse in any language the user speaks.
4. Keep your answers concise, practical, and highly professional.
5. If the user's query requires current real-time financial information (like interest rates, stock prices, exchange rates, banking news, today's rates, latest updates), utilize the provided search context. If no search context is provided or it doesn't answer the question, state that you don't have real-time access for it.
  6. Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", or any preamble in your response. Output ONLY the final answer starting directly with the information requested.
7. For simple greetings (hi, hello, hey), reply with a brief professional greeting and offer to help with financial questions.
`,o=/rate|interest|current|today|latest|stock|price|news|bank|sbi|hdfc|icici|offer|loan|mortgage|market|yield|fd|rd|crypto|gold/i.test(n);let r="";const c=R();if(o&&c)try{const i=await I("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:c,query:`finance banking: ${n}`,search_depth:"basic",include_answer:!0,max_results:3,topic:"finance"})},P);if(i.ok){const u=await i.json();r=`[Search Results from Internet]:
${u.answer||""}

`,u.results&&(r+=u.results.map(m=>`- ${m.title}: ${m.content}`).join(`
`))}}catch(i){console.warn("Tavily search failed for chat:",i)}const l=[{role:"system",content:a},...t.map(i=>i.role==="user"&&i.content===n&&r?{role:"user",content:`${r}
User Question: ${i.content}`}:i)];return j(l)}export{W as a,k as b,J as c,U as g,y as h,z as s,H as t};
