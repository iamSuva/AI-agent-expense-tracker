import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import readline from "node:readline/promises";
dotenv.config();
const groq = new Groq({apiKey: process.env.GROQ_API_KEY});

const expenseDB =[];
const incomeDB =[];

const SYSTEM_PROMPT = `
        You are James, a personal finance assistant. Your task is to help the user manage their expenses and income.
        You have access to the following tools:
        - getTotalExpense({from,to}) : string // returns the total expense for the given date range
        - addExpense({amount,description}) : string // adds a new expense to the database
        - addIncome({amount,description}) : string // adds a new income to the database
        - getRemainingBalance() : string // returns the remaining balance

        Use the tools when the user's intent is to record or look up expenses or income (e.g. they mention a purchase, income, or ask for balance/totals).
        Only call addExpense or addIncome when the user has provided the amount (and description) in their message. Never invent or assume amounts. If the user only agrees (e.g. "okay", "yes") without stating how much, ask them for the amount and do not call the tool.
        For greetings and general chat, respond in natural language without calling tools. When you use a tool, return the result as the tool specifies.`;


const tools={
    "getTotalExpense": async ({from,to}) => {
        console.log("getTotalExpense tool called");
        const totalExpense = expenseDB.reduce((acc,curr)=>acc+curr.amount,0);
        return `the total expense is ${totalExpense} INR`;
    },
    "addExpense": async ({amount,description}) => {
        console.log("addExpense tool called");
        expenseDB.push({amount,description});
        return `Expense added successfully for the amount of ${amount} and description ${description}`;
    },
    "addIncome": async ({amount,description}) => {
        console.log("addIncome tool called");
        incomeDB.push({amount,description});
        return `Income added successfully for the amount of ${amount} and description ${description}`;
    },
    "getRemainingBalance": async () => {
        console.log("getRemainingBalance tool called");
        const totalExpense = expenseDB.reduce((acc,curr)=>acc+curr.amount,0);
        const totalIncome = incomeDB.reduce((acc,curr)=>acc+curr.amount,0);
        const remainingBalance = totalIncome - totalExpense;
        return `The remaining balance is ${remainingBalance} INR`;
    }
}

async function callAgent(){
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    console.log("**AI-Agent** >> Hello! I'm your personal finance assistant. How can I help you today?");
    console.log("--------------------------------");
    console.log("type exit to exit the program");
    console.log("--------------------------------");
    const messages= [
        {
            "role":"system",
            "content":SYSTEM_PROMPT
        }
    ]
   
    while(true){

        const query = await rl.question("**You** >> : ");

        if(query.toLowerCase() === "exit"){
            console.log("**AI-Agent** >> Goodbye! Thank you for using my services.");
            console.log("--------------------------------");
            break;
        }
        messages.push({role:"user", content:query});

        while(true){
            try {
            const chat = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages:messages,
                tools:[
                    {
                        "type":"function",
                        "function":{
                            "name":"getTotalExpense",
                            "description":"Get the total expense for the given date range",
                            "parameters":{
                                "type":"object",
                                "properties":{
                                "from":{
                                    "type":"string",
                                    "description":"The start date of the date range"
                                },
                                "to":{
                                    "type":"string",
                                    "description":"The end date of the date range"
                                }
                            }
                            }
                        }
                    },
                    {
                        "type":"function",
                        "function":{
                            "name":"addExpense",
                            "description":"Add a new expense to the database",
                            "parameters":{
                                "type":"object",
                                "properties":{
                                    "amount":{
                                        "type":"number",
                                        "description":"The amount of the expense"
                                    },
                                    "description":{
                                        "type":"string",
                                        "description":"The description of the expense"
                                    }
                                },
                                "required":["amount","description"]
                            }
                        }
                    },
                    {
                        "type":"function",
                        "function":{
                            "name":"addIncome",
                            "description":"Add a new income to the database",
                            "parameters":{
                                "type":"object",
                                "properties":{
                                    "amount":{
                                        "type":"number",
                                        "description":"The amount of the income"
                                    },
                                    "description":{
                                        "type":"string",
                                        "description":"The description of the income"
                                    }
                                },
                                "required":["amount","description"]
                            }
                        }
                    },
                    {
                        "type":"function",
                        "function":{
                            "name":"getRemainingBalance",
                            "description":"Get the remaining balance",
                        },

                    }
                ]
            });
            const response = chat.choices[0].message
            messages.push(response);
            const toolCall = response.tool_calls;
            if(!toolCall){
                console.log("\n\n-----AI ending-----\n\n")
                console.log(" **AI-Agent** >> ",response.content);
                break;
            }
            for(const tool of toolCall){
                const toolName = tool.function.name;
                const rawArgs = tool.function.arguments;
                const toolInput = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
                let result ="";
                if(toolName === "getTotalExpense"){
                    result = await tools[toolName](toolInput);
                }
                else if(toolName === "addExpense"){
                    result = await tools[toolName](toolInput);
                }
                else if(toolName === "addIncome"){
                    result = await tools[toolName](toolInput);
                }
                else if(toolName === "getRemainingBalance"){
                    result = await tools[toolName](toolInput);
                }
                messages.push({
                    role:"tool",
                    content:result,
                    tool_call_id:tool.id
                })
            }
            } catch (err) {
                console.log(err);
                const msg = err?.error?.error?.message ?? err?.message ?? "Request failed";
                const failedGen = err?.error?.error?.failed_generation;
                console.log("\n **AI-Agent** >> Something went wrong with the last request.");
                if (failedGen) console.log("(The model returned invalid tool format. Try rephrasing your message.)");
                else console.log(" **AI-Agent** >> ", msg);
                break;
            }
        }
    }
    rl.close();
}
callAgent();