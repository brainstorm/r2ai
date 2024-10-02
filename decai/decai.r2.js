(function () {
    const decaiHelp = `
To use decai with commercial APIs run the following commands inside r2:

* decai -e api=claude    # or api=openai
* Write the keys in ~/.r2ai.openai-key or ~/.r2ai.anthropic-key

You need r2ai webserver to be running, to do this run 'r2ai -w' in a separate terminal.

  $ r2pm -ci r2ai

The best model for decompiling is ClaudeAI from Anthropic:

  $ r2pm -r r2ai
  $ echo $CLAUDEAPIKEY > ~/.r2ai.anthropic
  [r2ai:0x0000000]> -m anthropic:claude-3-5-sonnet-20240620
  [r2ai:0x0000000]> -w
  Webserver listening at port 8080

If you want to run r2ai in local you should use granite, mistral, llama3, gemma or mistral
PD: Granite woeks quite well

  [r2ai:0x0000000]> -m ibm-granite/granite-20b-code-instruct-8k-GGUF
  [r2ai:0x0000000]> -m QuantFactory/granite-8b-code-instruct-4k-GGUF
  [r2ai:0x0000000]> -m TheBloke/Mistral-7B-Instruct-v0.2-GGUF
  [r2ai:0x0000000]> -w

You can also make r2ai -w talk to an 'r2ai-server' using this line:

  [r2ai:0x0000000]> -m openapi:http://localhost:8080
  [r2ai:0x0000000]> -e http.port=8082

  [0x0000000]> decai -e host=http://localhost:8082
`;
    const command = "decai";
    let decaiHost = "http://localhost";
    let decaiPort = "8080";
    let decaiApi = "r2"; // uses /cmd endpoint
    let decaiCommands = "pdc";
    let decaiLanguage = "C";
    let decaiDebug = false;
    let decaiContextFile = "";
    let lastOutput = "";
    let decaiCache = false; // not implemented yet
    let decprompt = "Only show the code with no explanation or introductions. Simplify the code: - take function arguments from comment - remove dead assignments - refactor goto with for/if/while - use better names for variables - simplify as much as possible";
    // decprompt += ", comments in function calls may replace arguments and remove unnecessary early variable assignments that happen"

    function decaiEval(arg) {
        const [k, v] = arg.split("=");
        if (!v) {
            switch (k) {
            case "debug":
                console.log(decaiDebug);
                break;
            case "api":
                console.log(decaiApi);
                break;
            case "lang":
                console.log(decaiLanguage);
                break;
            case "cache":
                console.log(decaiCache);
                break;
            case "cmds":
                console.log(decaiCommands);
                break;
            case "prompt":
                console.log(decprompt);
                break;
            case "ctxfile":
                console.log(decaiContextFile);
                break;
            case "host":
                console.log(decaiHost);
                break;
            case "port":
                console.log(decaiPort);
                break;
            default:
                console.error("Unknown key");
                break;
            }
            return;
        }
        switch (k) {
        case "debug":
            decaiDebug = (v === "true" || v === "1");
            break;
        case "api":
            if (v === "?") {
                console.error("r2ai\nclaude\nopenapi\nopenai");
            } else {
                decaiApi = v;
            }
            break;
        case "cache":
            decaiCache = v;
            break;
        case "ctxfile":
            decaiContextFile = v;
            break;
        case "lang":
            decaiLanguage = v;
            break;
        case "cmds":
            decaiCommands = v;
            break;
        case "prompt":
            decprompt = v;
            break;
        case "host":
            decaiHost = v;
            break;
        case "port":
            decaiPort = v;
            break;
        default:
            console.error("Unknown key");
            break;
        }
    }
    function usage() {
        console.error("Usage: " + command + " (-h) ...");
        console.error(" " + command + " -H        - help setting up r2ai");
        console.error(" " + command + " -d        - decompile current function");
        console.error(" " + command + " -e        - display and change eval config vars");
        console.error(" " + command + " -h        - show this help");
        console.error(" " + command + " -n        - suggest better function name");
        console.error(" " + command + " -q [text] - query language model with given text");
        console.error(" " + command + " -Q [text] - query on top of the last output");
        console.error(" " + command + " -r        - change role prompt (same as: decai -e prompt)");
        console.error(" " + command + " -v        - show local variables");
        console.error(" " + command + " -V        - find vulnerabilities");
        console.error(" " + command + " -x        - eXplain current function");
    }
    function r2aiAnthropic(msg) {
       const claudeKey = r2.cmd("'cat ~/.r2ai.anthropic-key").trim()
       const claudeModel = "claude-3-5-sonnet-20240620";
       if (claudeKey === '') {
           return "Cannot read ~/.r2ai.anthropic-key";
       }
       const payload = JSON.stringify({
           model: claudeModel,
           max_tokens: 5128,
           messages: [
               {
                   "role": "user",
                   "content": decprompt + ", Explain this pseudocode in " + decaiLanguage + "\n" + msg
               }
           ]
       });
       const curlcmd = `curl -s https://api.anthropic.com/v1/messages
          -H "Content-Type: application/json"
          -H "anthropic-version: 2023-06-01"
          -H "x-api-key: ${claudeKey}"
          -d '${payload}'`.replace(/\n/g, "");
        if (decaiDebug) {
            console.log(curlcmd);
        }
        const res = r2.syscmds(curlcmd);
        try {
            return JSON.parse(res).content[0].text;
        } catch(e) {
            console.error("ERROR");
            console.error(e);
            console.log("RES((" + res + "))");
        }
        return "error invalid response";
    }
    function r2aiHuggingFace(msg) {
        const hfKey = r2.cmd("'cat ~/.r2ai.huggingface-key").trim();
        const hfModel = "deepseek-ai/DeepSeek-Coder-V2-Instruct";
        //const hfModel = "meta-llama/Llama-3.1-8B-Instruct";
        //const hfModel = "meta-llama/Llama-3.2-1B-Instruct";
        //const hfModel = "Qwen/Qwen2.5-72B-Instruct";
        if (hfKey === '') {
            return "Cannot read ~/.r2ai.huggingface-key";
        }
        const payload = JSON.stringify({
            inputs: decprompt + ", Explain this pseudocode in " + decaiLanguage + "\n" + msg,
            parameters: {
                max_new_tokens: 5128
            }
        });
        const curlcmd = `curl -s https://api-inference.huggingface.co/models/${hfModel}
            -H "Authorization: Bearer ${hfKey}"
            -H "Content-Type: application/json"
            -d '${payload}'`.replace(/\n/g, "");
        //if (decaiDebug) {
        //     console.log(curlcmd);
        //}

        const res = r2.syscmds(curlcmd);
        // Debug response instead of request
        if (decaiDebug) {
            console.log(res)
        }

        try {
            return JSON.parse(res).generated_text;
        } catch (e) {
            console.error(e);
            console.log(res);
        }
        return "error invalid response";
    }

    function r2aiOpenAI(msg) {
       const openaiKey = r2.cmd("'cat ~/.r2ai.openai-key").trim()
       // const openaiModel = "gpt-3.5-turbo";
       const openaiModel = "gpt-4";
       if (openaiKey === '') {
           return "Cannot read ~/.r2ai.openai-key";
       }
       const payload = JSON.stringify({
           model: openaiModel,
           max_tokens: 5128,
           messages: [
               {"role": "system", "content": decprompt }, {
                   "role": "user",
                   "content": decprompt + ", Explain this pseudocode in " + decaiLanguage + "\n" + msg
               }
           ]
       });
       const curlcmd = `curl -s https://api.openai.com/v1/chat/completions
          -H "Content-Type: application/json"
          -H "Authorization: Bearer ${openaiKey}"
          -d '${payload}' #`.replace(/\n/g, "");
        if (decaiDebug) {
            console.log(curlcmd);
        }
        const res = r2.syscmds(curlcmd);
        try {
            return JSON.parse(res).choices[0].message.content;
        } catch(e) {
            console.error(e);
            console.log(res);
        }
        return "error invalid response";
    }
    function r2aiOpenAPI(msg) {
        const payload = JSON.stringify({ "prompt": decprompt + ", Explain this pseudocode in " + decaiLanguage + "\n" + msg });
        const curlcmd = `curl -s ${decaiHost}:${decaiPort}/completion
          -H "Content-Type: application/json"
          -d '${payload}' #`.replace(/\n/g, "");
        if (decaiDebug) {
            console.log(curlcmd);
        }
        const res = r2.syscmds(curlcmd);
        try {
            return JSON.parse(res).content;
        } catch(e) {
            console.error(e);
            console.log(res);
        }
        return "error invalid response";
    }
    function fileDump(fileName, fileData) {
        const d = b64(fileData);
        r2.cmd("p6ds " + d + " > " + fileName);
    }
    function r2ai(queryText, fileData) {
        if (!fileData) {
            fileData = "";
        }
        fileData = fileData.replace(/\`/g, '').replace(/'/g, '"');
        queryText = queryText.replace(/'/g, '');
        if (decaiApi === "r2" || decaiApi === "r2ai") {
            const fileName = "/tmp/.pdc.txt";
            fileDump(fileName, fileData);
            const q = queryText.startsWith("-")? queryText: ["-i", fileName, queryText].join(" ");
            const host = decaiHost + ":" + decaiPort + "/cmd"; // "http://localhost:8080/cmd";
            const ss = q.replace(/ /g, "%20").replace(/'/g, "\\'");
            const cmd = 'curl -s "' + host + '/' + ss + '" || echo Cannot curl, use r2ai-server or r2ai -w #';
            if (decaiDebug) {
                console.error(cmd);
            }
            return r2.syscmds(cmd);
        }
        if (fileData === "" || queryText.startsWith("-")) { // -i
            return "";
        }
        const q = queryText + fileData;
        if (decaiApi === "anthropic" || decaiApi === "claude") {
            return r2aiAnthropic(q);
        }
        if (decaiApi === "huggingface") {
            return r2aiHuggingFace(q);
        }
        if (decaiApi === "openapi") {
            return r2aiOpenAPI(q);
        }
        if (decaiApi === "openai") {
            return r2aiOpenAI(q);
        }
        return "Unknown value for 'decai -e api'. Use r2ai, claude, huggingface, openapi or openai";
    }
    function r2aidec(args) {
        if (args === "") {
            usage();
        } else if (args[0] === "-") {
            var out = "";
            switch (args[1]) {
            case "H": // "-H"
                console.log(decaiHelp);
                break;
            case "n": // "-n"
            case "f": // "-f"
                out = r2.cmd("pdc");
                var considerations = r2.cmd("fd.").trim().split(/\n/).filter(x=>!x.startsWith("secti")).join(",");
                // console.log(considerations);
                r2ai("-R");
                out = r2ai("give me a better name for this function. the output must be: 'afn NEWNAME'. do not include the function code, only the afn line. consider: " + considerations, out).trim();
		out += " @ " + r2.cmd("?v $FB").trim();
                break;
            case "v": // "-v"
                out = r2.cmd("afv;pdc");
                r2ai("-R");
                out = r2ai("guess a better name and type for each local variable and function argument taking using. output an r2 script using afvn and afvt commands", out);
                break;
            case "r": // "-r"
                args = args.slice(2).trim();
                if (args) {
                    decprompt = args
                } else {
                    console.log(decprompt);
                }
                break;
            case "V": // "-V"
                r2aidec("-d find vulnerabilities, dont show the code, only show the response");
                break;
            case "e": // "-e"
                args = args.slice(2).trim();
                if (args) {
                    decaiEval(args);
                } else {
                    console.log("decai -e api=" + decaiApi);
                    console.log("decai -e host=" + decaiHost);
                    console.log("decai -e port=" + decaiPort);
                    console.log("decai -e prompt=" + decprompt);
                    console.log("decai -e ctxfile=" + decaiContextFile);
                    console.log("decai -e cmds=" + decaiCommands);
                    console.log("decai -e cache=" + decaiCache);
                    console.log("decai -e lang=" + decaiLanguage);
                    console.log("decai -e debug=" + decaiDebug);
                }
                break;
            case "q": // "-q"
                out = r2ai(args.slice(2).trim());
                break;
            case "Q": // "-Q"
                out = r2ai(args.slice(2).trim(), lastOutput);
                break;
            case "x": // "-x"
                out = r2.cmd("pdsf@e:scr.color=0");
                r2ai("-R");
                out = r2ai("Explain whats this function doing in one sentence.", out)
                break;
            case "d": // "-d"
                try {
                    args = args.slice(2).trim();
                    const file = "/tmp/.pdc.txt";
                    r2.call("rm .pdc.txt");
                    r2.call("rm " + file);
                    r2.cmd("echo > " + file);
                    let count = 0;
                    let text = "";
		    if (decaiContextFile !== "") {
                        if (r2.cmd2("test -f " + decaiContextFile).value === 0) {
			    text += "Context:\n";
                            text += "[RULES]\n";
                            text += r2.cmd("cat " + decaiContextFile);
                            text += "[/RULES]\n";
                        }
		    }
                    const origColor = r2.cmd("e scr.color");
                    r2.cmd("e scr.color=0");
                    for (const c of decaiCommands.split(",")) {
                        if (c.trim() === "") {
                            continue;
                        }
                        const output = r2.cmd(c);
                        if (output.length > 5) {
                            text += "Output from " + c + ":\n";
                            text += "[BEGIN]\n";
                            text += output + "\n";
                            text += "[END]\n";
                            count++;
                        }
                    }
                    r2.cmd("e scr.color=" + origColor);
                    if (count === 0) {
                        console.error("Nothing to do.");
                        break;
                    }
                    r2ai("-R");
                    const query = (decprompt + " " + args).trim() + ". Explain this pseudocode in " + decaiLanguage;
                    out = r2ai(query, text);
                    lastOutput = out;
                } catch (e) {
                    console.error(e);
                }
                break;
            default:
                usage();
                break;
            }
	    if (out) {
                r2.log(out);
	    }
        } else {
            usage();
        }
        return true;
    }
    r2.unload("core", command);
    r2.plugin("core", function () {
        function coreCall(cmd) {
            if (cmd.startsWith(command)) {
                var args = cmd.slice(command.length).trim();
                return r2aidec(args);
            }
            return false;
        }
        return {
            "name": command,
            "license": "MIT",
            "desc": "r2 decompiler based on r2ai",
            "call": coreCall,
        };
    });
})();
