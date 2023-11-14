/**
 * **code-input** is a library which lets you create custom HTML `<code-input>`
 * elements that act like `<textarea>` elements but support syntax-highlighted
 * code, implemented using any typical syntax highlighting library. [MIT-Licensed]
 * 
 * **<https://github.com/WebCoder49/code-input>**
 */


var codeInput = {
    /**
     * A list of attributes that will trigger the 
     * `codeInput.CodeInput.attributeChangedCallback` 
     * when modified in a code-input element. This
     * does not include events, which are handled in
     * `codeInput.CodeInput.addEventListener` and
     * `codeInput.CodeInput.removeEventListener`.
     */
    observedAttributes: [
        "value",
        "placeholder",
        "lang",
        "template"
    ],

    /**
     * A list of attributes that will be moved to 
     * the textarea after they are applied on the 
     * code-input element.
     */
    textareaSyncAttributes: [
        "aria-*",
        "value",
        // Form validation - https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation#using_built-in_form_validation
        "min", "max",
        "type",
        "pattern",

        // Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea
        "autocomplete", 
        "autocorrect", 
        "autofocus",
        "cols",
        "dirname",
        "disabled",
        "form",
        "maxlength",
        "minlength",
        "name",
        "placeholder",
        "readonly",
        "required",
        "rows",
        "spellcheck",
        "wrap"
    ],

    /**
     * A list of events whose listeners will be moved to 
     * the textarea after they are added to the 
     * code-input element.
     */
    textareaSyncEvents: [
        "change",
        "selectionchange",
        "invalid",
        "input"
    ],

    /* ------------------------------------
    *  ------------Templates---------------
    *  ------------------------------------ */

    /**
     * The templates currently available for any code-input elements
     * to use. Registered using `codeInput.registerTemplate`.
     * Key - Template Name
     * Value - A Template Object
     * @type {Object}
     */
    usedTemplates: {
    },
    /**
     * The name of the default template that a code-input element that
     * does not specify the template attribute uses. 
     * @type {string}
     */
    defaultTemplate: undefined,
    /**
     * A queue of elements waiting for a template to be registered,
     * allowing elements to be created in HTML with a template before
     * the template is registered in JS, for ease of use.
     * Key - Template Name
     * Value - An array of code-input elements
     * @type {Object}
     */
    templateNotYetRegisteredQueue: {},

    /**
     * Register a template so code-input elements with a template attribute that equals the templateName will use the template.
     * See `codeInput.templates` for constructors to create templates.
     * @param {string} templateName - the name to register the template under
     * @param {Object} template - a Template object instance - see `codeInput.templates`  
     */
    registerTemplate: function (templateName, template) {
        if(!(typeof templateName == "string" || templateName instanceof String)) throw TypeError(`code-input: Template for "${templateName}" must be a string.`);
        if(!(typeof template.highlight == "function" || template.highlight instanceof Function)) throw TypeError(`code-input: Template for "${templateName}" invalid, because the highlight function provided is not a function; it is "${template.highlight}". Please make sure you use one of the constructors in codeInput.templates, and that you provide the correct arguments.`);
        if(!(typeof template.includeCodeInputInHighlightFunc == "boolean" || template.includeCodeInputInHighlightFunc instanceof Boolean)) throw TypeError(`code-input: Template for "${templateName}" invalid, because the includeCodeInputInHighlightFunc value provided is not a true or false; it is "${template.includeCodeInputInHighlightFunc}". Please make sure you use one of the constructors in codeInput.templates, and that you provide the correct arguments.`);
        if(!(typeof template.preElementStyled == "boolean" || template.preElementStyled instanceof Boolean)) throw TypeError(`code-input: Template for "${templateName}" invalid, because the preElementStyled value provided is not a true or false; it is "${template.preElementStyled}". Please make sure you use one of the constructors in codeInput.templates, and that you provide the correct arguments.`);
        if(!(typeof template.isCode == "boolean" || template.isCode instanceof Boolean)) throw TypeError(`code-input: Template for "${templateName}" invalid, because the isCode value provided is not a true or false; it is "${template.isCode}". Please make sure you use one of the constructors in codeInput.templates, and that you provide the correct arguments.`);
        if(!Array.isArray(template.plugins)) throw TypeError(`code-input: Template for "${templateName}" invalid, because the plugin array provided is not an array; it is "${template.plugins}". Please make sure you use one of the constructors in codeInput.templates, and that you provide the correct arguments.`);
        
        template.plugins.forEach((plugin, i) => {
            if(!(plugin instanceof codeInput.Plugin)) {
                throw TypeError(`code-input: Template for "${templateName}" invalid, because the plugin provided at index ${i} is not valid; it is "${template.plugins[i]}". Please make sure you use one of the constructors in codeInput.templates, and that you provide the correct arguments.`);
            }
        });

        
        codeInput.usedTemplates[templateName] = template;
        // Add waiting code-input elements wanting this template from queue
        if (templateName in codeInput.templateNotYetRegisteredQueue) {
            for (let i in codeInput.templateNotYetRegisteredQueue[templateName]) {
                elem = codeInput.templateNotYetRegisteredQueue[templateName][i];
                elem.template = template;
                codeInput.runOnceWindowLoaded((function(elem) { elem.connectedCallback(); }).bind(null, elem), elem);
                // Bind sets elem in parameter 
                // So innerHTML can be read
            }
            console.log(`code-input: template: Added existing elements with template ${templateName}`);
        }

        if (codeInput.defaultTemplate == undefined) {
            codeInput.defaultTemplate = templateName;
            // Add elements with default template from queue
            if (undefined in codeInput.templateNotYetRegisteredQueue) {
                for (let i in codeInput.templateNotYetRegisteredQueue[undefined]) {
                    elem = codeInput.templateNotYetRegisteredQueue[undefined][i];
                    elem.template = template;
                    codeInput.runOnceWindowLoaded((function(elem) { elem.connectedCallback(); }).bind(null, elem), elem);
                    // Bind sets elem in parameter 
                    // So innerHTML can be read
                }
            }
            console.log(`code-input: template: Set template ${templateName} as default`);
        }
        console.log(`code-input: template: Created template ${templateName}`);
    },

    /**
     * Please see `codeInput.templates.prism` or `codeInput.templates.hljs`.
     * Templates are used in `<code-input>` elements and once registered with
     * `codeInput.registerTemplate` will be in charge of the highlighting
     * algorithm and settings for all code-inputs with a `template` attribute
     * matching the registered name.
     */
    Template: class {
        /**
         * Constructor to create a custom template instance. Pass this into `codeInput.registerTemplate` to use it.
         * I would strongly recommend using the built-in simpler template `codeInput.templates.prism` or `codeInput.templates.hljs`.
         * @param {Function} highlight - a callback to highlight the code, that takes an HTML `<code>` element inside a `<pre>` element as a parameter
         * @param {boolean} preElementStyled - is the `<pre>` element CSS-styled as well as the `<code>` element? If true, `<pre>` element's scrolling is synchronised; if false, `<code>` element's scrolling is synchronised.
         * @param {boolean} isCode - is this for writing code? If true, the code-input's lang HTML attribute can be used, and the `<code>` element will be given the class name 'language-[lang attribute's value]'.
         * @param {boolean} includeCodeInputInHighlightFunc - Setting this to true passes the `<code-input>` element as a second argument to the highlight function.
         * @param {codeInput.Plugin[]} plugins - An array of plugin objects to add extra features - see `codeInput.Plugin`
         * @returns template object
         */
        constructor(highlight = function () { }, preElementStyled = true, isCode = true, includeCodeInputInHighlightFunc = false, plugins = []) {
            this.highlight = highlight;
            this.preElementStyled = preElementStyled;
            this.isCode = isCode;
            this.includeCodeInputInHighlightFunc = includeCodeInputInHighlightFunc;
            this.plugins = plugins;
        }

        /**
         * A callback to highlight the code, that takes an HTML `<code>` element 
         * inside a `<pre>` element as a parameter, and an optional second
         * `<code-input>` element parameter if `this.includeCodeInputInHighlightFunc` is
         * `true`.
         */
        highlight = function() {};

        /**
         * Is the <pre> element CSS-styled as well as the `<code>` element? 
         * If `true`, `<pre>` element's scrolling is synchronised; if false, 
         * <code> element's scrolling is synchronised.
         */
        preElementStyled = true;

        /**
         * Is this for writing code? 
         * If true, the code-input's lang HTML attribute can be used, 
         * and the `<code>` element will be given the class name 
         * 'language-[lang attribute's value]'.
         */
        isCode = true;

        /**
         * Setting this to true passes the `<code-input>` element as a 
         * second argument to the highlight function.
         */
        includeCodeInputInHighlightFunc = false;

        /**
         * An array of plugin objects to add extra features - 
         * see `codeInput.Plugin`.
         */
        plugins = [];
    },

    /**
     * For creating a custom template from scratch, please 
     * use `new codeInput.Template(...)`
     * 
     * Shortcut functions for creating templates.
     * Each code-input element has a template attribute that 
     * tells it which template to use.
     * Each template contains functions and preferences that 
     * run the syntax-highlighting and let code-input control 
     * the highlighting.
     * For adding small pieces of functionality, please see `codeInput.plugins`.
     */
    templates: {
        /**
         * Constructor to create a template that uses Prism.js syntax highlighting (https://prismjs.com/)
         * @param {Object} prism Import Prism.js, then after that import pass the `Prism` object as this parameter.
         * @param {codeInput.Plugin[]} plugins - An array of plugin objects to add extra features - see `codeInput.plugins`
         * @returns template object
         */
        prism(prism, plugins = []) { // Dependency: Prism.js (https://prismjs.com/)
            return {
                includeCodeInputInHighlightFunc: false,
                highlight: prism.highlightElement,
                preElementStyled: true,
                isCode: true,
                plugins: plugins,
            };
        },
        /**
         * Constructor to create a template that uses highlight.js syntax highlighting (https://highlightjs.org/)
         * @param {Object} hljs Import highlight.js, then after that import pass the `hljs` object as this parameter.
         * @param {codeInput.Plugin[]} plugins - An array of plugin objects to add extra features - see `codeInput.plugins`
         * @returns template object
         */
        hljs(hljs, plugins = []) { // Dependency: Highlight.js (https://highlightjs.org/)
            return {
                includeCodeInputInHighlightFunc: false,
                highlight: hljs.highlightElement,
                preElementStyled: false,
                isCode: true,
                plugins: plugins,
            };
        },

        /**
         * Constructor to create a proof-of-concept template that gives a message if too many characters are typed.
         * @param {codeInput.Plugin[]} plugins - An array of plugin objects to add extra features - see `codeInput.plugins`
         * @returns template object
         */
        characterLimit(plugins) {
            return {
                highlight: function (resultElement, codeInput, plugins = []) {

                    let characterLimit = Number(codeInput.getAttribute("data-character-limit"));

                    let normalCharacters = codeInput.escapeHtml(codeInput.value.slice(0, characterLimit));
                    let overflowCharacters = codeInput.escapeHtml(codeInput.value.slice(characterLimit));

                    resultElement.innerHTML = `${normalCharacters}<mark class="overflow">${overflowCharacters}</mark>`;
                    if (overflowCharacters.length > 0) {
                        resultElement.innerHTML += ` <mark class="overflow-msg">${codeInput.getAttribute("data-overflow-msg") || "(Character limit reached)"}</mark>`;
                    }
                },
                includeCodeInputInHighlightFunc: true,
                preElementStyled: true,
                isCode: false,
                plugins: plugins,
            }
        },

        /**
         * Constructor to create a proof-of-concept template that shows text in a repeating series of colors.
         * @param {string[]} rainbowColors - An array of CSS colors, in the order each color will be shown
         * @param {string} delimiter - The character used to split up parts of text where each part is a different colour (e.g. "" = characters, " " = words)
         * @param {codeInput.Plugin[]} plugins - An array of plugin objects to add extra features - see `codeInput.plugins`
         * @returns template object
         */
        rainbowText(rainbowColors = ["red", "orangered", "orange", "goldenrod", "gold", "green", "darkgreen", "navy", "blue", "magenta"], delimiter = "", plugins = []) {
            return {
                highlight: function (resultElement, codeInput) {
                    let htmlResult = [];
                    let sections = codeInput.value.split(codeInput.template.delimiter);
                    for (let i = 0; i < sections.length; i++) {
                        htmlResult.push(`<span style="color: ${codeInput.template.rainbowColors[i % codeInput.template.rainbowColors.length]}">${codeInput.escapeHtml(sections[i])}</span>`);
                    }
                    resultElement.innerHTML = htmlResult.join(codeInput.template.delimiter);
                },
                includeCodeInputInHighlightFunc: true,
                preElementStyled: true,
                isCode: false,
                rainbowColors: rainbowColors,
                delimiter: delimiter,
                plugins: plugins,
            }
        },

        /**
         * @deprecated Please use `codeInput.characterLimit(plugins)`
         */
        character_limit() {
            return this.characterLimit([]);
        },
        /**
         * @deprecated Please use `codeInput.rainbowText`
         */
        rainbow_text(rainbowColors = ["red", "orangered", "orange", "goldenrod", "gold", "green", "darkgreen", "navy", "blue", "magenta"], delimiter = "", plugins = []) {
            return this.rainbowText(rainbowColors, delimiter, plugins);
        },
        
        /**
         * @deprecated Please use `new codeInput.Template()`
         */
        custom(highlight = function () { }, preElementStyled = true, isCode = true, includeCodeInputInHighlightFunc = false, plugins = []) {
            return {
                highlight: highlight,
                includeCodeInputInHighlightFunc: includeCodeInputInHighlightFunc,
                preElementStyled: preElementStyled,
                isCode: isCode,
                plugins: plugins,
            };
        },
    },

    /* ------------------------------------
    *  ------------Plugins-----------------
    *  ------------------------------------ */

    /**
     * Before using any plugin in this namespace, please ensure you import its JavaScript
     * files (in the plugins folder), or continue to get a more detailed error in the developer
     * console.
     * 
     * Where plugins are stored, after they are imported. The plugin
     * file assigns them a space in this object.
     * For adding completely new syntax-highlighting algorithms, please see `codeInput.templates`.
     * 
     * Key - plugin name
     * 
     * Value - plugin object
     * @type {Object}
     */
    plugins: new Proxy({}, {
        get(plugins, name) {
            if(plugins[name] == undefined) {
                throw ReferenceError(`code-input: Plugin '${name}' is not defined. Please ensure you import the necessary files from the plugins folder in the WebCoder49/code-input repository, in the <head> of your HTML, before the plugin is instatiated.`);
            }
            return plugins[name];
        }
    }),

    /**
     * Plugins are imported from the plugins folder. They will then
     * provide custom extra functionality to code-input elements.
     */
    Plugin: class {
        /**
         * Create a Plugin
         * 
         * @param {Array<string>} observedAttributes - The HTML attributes to watch for this plugin, and report any 
         * modifications to the `codeInput.Plugin.attributeChanged` method.
         */
        constructor(observedAttributes) {
            console.log("code-input: plugin: Created plugin");

            observedAttributes.forEach((attribute) => {
                // Move plugin attribute to codeInput observed attributes
                let regexFromWildcard = codeInput.wildcard2regex(attribute);
                if(regexFromWildcard == null) {
                    // Not a wildcard
                    codeInput.observedAttributes.push(attribute);
                } else {
                    codeInput.observedAttributes.regexp.push(regexFromWildcard);
                }
            });
        }

        /**
         * Runs before code is highlighted.
         * @param {codeInput.CodeInput} codeInput - The codeInput element
         */
        beforeHighlight(codeInput) { }
        /**
         * Runs after code is highlighted.
         * @param {codeInput.CodeInput} codeInput - The codeInput element
         */
        afterHighlight(codeInput) { }
        /**
         * Runs before elements are added into a code-input element.
         * @param {codeInput.CodeInput} codeInput - The codeInput element
         */
        beforeElementsAdded(codeInput) { }
        /**
         * Runs after elements are added into a code-input element (useful for adding events to the textarea).
         * @param {codeInput.CodeInput} codeInput - The codeInput element
         */
        afterElementsAdded(codeInput) { }
        /**
         * Runs when an attribute of a code-input element is changed (you must add the attribute name to `codeInput.Plugin.observedAttributes` first).
         * @param {codeInput.CodeInput} codeInput - The codeInput element
         * @param {string} name - The name of the attribute
         * @param {string} oldValue - The value of the attribute before it was changed
         * @param {string} newValue - The value of the attribute after it is changed
         */
        attributeChanged(codeInput, name, oldValue, newValue) { }
    },

    /* ------------------------------------
    *  -------------Main-------------------
    *  ------------------------------------ */

    /**
     * A code-input element.
     */
    CodeInput: class extends HTMLElement {
        constructor() {
            super(); // Element
        }
        /**
        * Store value internally
        */
        _value = '';

        /**
        * Exposed child textarea element for user to input code in
        */
        textareaElement = null;
        /**
        * Exposed child pre element where syntax-highlighted code is outputted.
        * Contains this.codeElement as its only child.
        */
        preElement = null;
        /**
        * Exposed child pre element's child code element where syntax-highlighted code is outputted.
        * Has this.preElement as its parent.
        */
        codeElement = null;

        /**
        * Form-Associated Custom Element Callbacks
        * https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-face-example
        */
        static formAssociated = true;

        /**
         * When events are transferred to the textarea element, callbacks
         * are bound to set the this variable to the code-input element
         * rather than the textarea. This allows the callback to be converted
         * to a bound one:
         * Key - Callback not bound
         * Value - Callback that is bound, with this equalling the code-input element in the callback 
         */
        boundEventCallbacks = {};

        /** Trigger this event in all plugins with a optional list of arguments 
         * @param {string} eventName - the name of the event to trigger
         * @param {Array} args - the arguments to pass into the event callback in the template after the code-input element. Normally left empty
        */
        pluginEvt(eventName, args) {
            for (let i in this.template.plugins) {
                let plugin = this.template.plugins[i];
                if (eventName in plugin) {
                    if (args === undefined) {
                        plugin[eventName](this);
                    } else {
                        plugin[eventName](this, ...args);
                    }
                }
            }
        }

        /* ------------------------------------
        *  ----------Main Functionality--------
        *  ------------------------------------ 
        * The main function of a code-input element is to take 
        * code written in its textarea element, copy this code into
        * the result (pre code) element, then use the template object
        * to syntax-highlight it. */

        /** Update the text value to the result element, after the textarea contents have changed.
         * @param {string} value - The text value of the code-input element
         * @param {boolean} originalUpdate - Whether this update originates from the textarea's content; if so, run it first so custom updates override it.
         */
        update(value) {
            // Prevent this from running multiple times on the same input when "value" attribute is changed, 
            // by not running when value is already equal to the input of this (implying update has already
            // been run). Thank you to peterprvy for this. 
            if (this.ignoreValueUpdate) return;

            if(this.textareaElement == null) {
                this.addEventListener("code-input_load", () => { this.update(value) }); // Only run when fully loaded
                return;
            }

            this.ignoreValueUpdate = true;
            this.value = value;
            this.ignoreValueUpdate = false;
            if (this.textareaElement.value != value) this.textareaElement.value = value;


            let resultElement = this.codeElement;

            // Handle final newlines
            if (value[value.length - 1] == "\n") {
                value += " ";
            }

            // Update code
            resultElement.innerHTML = this.escapeHtml(value);
            this.pluginEvt("beforeHighlight");

            // Syntax Highlight
            if (this.template.includeCodeInputInHighlightFunc) this.template.highlight(resultElement, this);
            else this.template.highlight(resultElement);

            this.pluginEvt("afterHighlight");
        }

        /**
         * Synchronise the scrolling of the textarea to the result element.
         */
        syncScroll() {
            let inputElement = this.textareaElement;
            let resultElement = this.template.preElementStyled ? this.preElement : this.codeElement;

            resultElement.scrollTop = inputElement.scrollTop;
            resultElement.scrollLeft = inputElement.scrollLeft;
        }

        /**
         * HTML-escape an arbitrary string.
         * @param {string} text - The original, unescaped text
         * @returns {string} - The new, HTML-escaped text
         */
        escapeHtml(text) {
            return text.replace(new RegExp("&", "g"), "&amp;").replace(new RegExp("<", "g"), "&lt;"); /* Global RegExp */
        }

        /**
         * HTML-unescape an arbitrary string.
         * @param {string} text - The original, HTML-escaped text
         * @returns {string} - The new, unescaped text
         */
        unescapeHtml(text) {
            return text.replace(new RegExp("&amp;", "g"), "&").replace(new RegExp("&lt;", "g"), "<").replace(new RegExp("&gt;", "g"), ">"); /* Global RegExp */
        }

        /**
         * Get the template object this code-input element is using.
         * @returns {Object} - Template object
         */
        getTemplate() {
            let templateName;
            if (this.getAttribute("template") == undefined) {
                // Default
                templateName = codeInput.defaultTemplate;
            } else {
                templateName = this.getAttribute("template");
            }
            if (templateName in codeInput.usedTemplates) {
                return codeInput.usedTemplates[templateName];
            } else {
                // Doesn't exist - add to queue
                if (!(templateName in codeInput.templateNotYetRegisteredQueue)) {
                    codeInput.templateNotYetRegisteredQueue[templateName] = [];
                }
                codeInput.templateNotYetRegisteredQueue[templateName].push(this);
                return undefined;
            }
        }

        /**
         * Set up and initialise the textarea.
         * This will be called once the template has been added.
         */
        setup() {
            if(this.textareaElement != null) return; // Already set up

            this.classList.add("code-input_registered"); // Remove register message
            if (this.template.preElementStyled) this.classList.add("code-input_pre-element-styled");

            this.pluginEvt("beforeElementsAdded");

            // First-time attribute sync
            let lang = this.getAttribute("lang");
            let placeholder = this.getAttribute("placeholder") || this.getAttribute("lang") || "";
            let value = this.unescapeHtml(this.innerHTML) || this.getAttribute("value") || "";
            // Value attribute deprecated, but included for compatibility

            this.initialValue = value; // For form reset

            // Create textarea
            let textarea = document.createElement("textarea");
            textarea.placeholder = placeholder;
            if(value != "") {
                textarea.value = value;
            }
            textarea.innerHTML = this.innerHTML;
            textarea.setAttribute("spellcheck", "false");

            this.innerHTML = ""; // Clear Content

            // Synchronise attributes to textarea
            codeInput.textareaSyncAttributes.forEach((attribute) => {
                if (this.hasAttribute(attribute)) {
                    textarea.setAttribute(attribute, this.getAttribute(attribute));
                }
            });
            codeInput.textareaSyncAttributes.regexp.forEach((reg) =>
            {
                for(const attr of this.attributes) {
                    if (attr.nodeName.match(reg)) {
                        textarea.setAttribute(attr.nodeName, attr.nodeValue);
                    }
                }
            });

            textarea.addEventListener('input', (evt) => { textarea.parentElement.update(textarea.value); textarea.parentElement.sync_scroll(); });
            textarea.addEventListener('scroll', (evt) => textarea.parentElement.sync_scroll());

            // Save element internally
            this.textareaElement = textarea;
            this.append(textarea);

            // Create result element
            let code = document.createElement("code");
            let pre = document.createElement("pre");
            pre.setAttribute("aria-hidden", "true"); // Hide for screen readers

            // Save elements internally
            this.preElement = pre;
            this.codeElement = code;
            pre.append(code);
            this.append(pre);

            if (this.template.isCode) {
                if (lang != undefined && lang != "") {
                    code.classList.add("language-" + lang);
                }
            }

            this.pluginEvt("afterElementsAdded");

            this.update(value);

            this.dispatchEvent(new CustomEvent("code-input_load"));
        }

        /**
         * @deprecated Please use `codeInput.CodeInput.syncScroll`
         */
        sync_scroll() {
            this.syncScroll();
        }

        /**
         * @deprecated Please use `codeInput.CodeInput.escapeHtml`
         */
        escape_html(text) {
            return this.escapeHtml(text);
        }

        /**
         * @deprecated Please use `codeInput.CodeInput.escapeHtml`
         */
        get_template() {
            return this.getTemplate();
        }


        /* ------------------------------------
        *  -----------Callbacks----------------
        *  ------------------------------------
        * Implement the `HTMLElement` callbacks
        * to trigger the main functionality properly. */

        /**
         * When the code-input element has been added to the document,
         * find its template and set up the element.
         */
        connectedCallback() {
            this.template = this.getTemplate();
            if (this.template != undefined) {
                this.classList.add("code-input_registered");
                codeInput.runOnceWindowLoaded(() => { 
                    this.setup();
                    this.classList.add("code-input_loaded");
                }, this);
            }
            this.mutationObserver = new MutationObserver(this.mutationObserverCallback.bind(this));
            this.mutationObserver.observe(this, {
                attributes: true,
                attributeOldValue: true
            });
        }

        mutationObserverCallback(mutationList, observer) {
            for (const mutation of mutationList) {
                if (mutation.type !== 'attributes')
                    continue;

                /* Check regular attributes */
                for(let i = 0; i < codeInput.observedAttributes.length; i++) {
                    if (mutation.attributeName == codeInput.observedAttributes[i]) {
                        return this.attributeChangedCallback(mutation.attributeName, mutation.oldValue, super.getAttribute(mutation.attributeName));
                    }
                }

                /* Check wildcard attributes */
                for(let i = 0; i < codeInput.observedAttributes.regexp.length; i++) {
                    const reg = codeInput.observedAttributes.regexp[i];
                    if (mutation.attributeName.match(reg)) {
                        return this.attributeChangedCallback(mutation.attributeName, mutation.oldValue, super.getAttribute(mutation.attributeName));
                    }
                }
            }
        }

        disconnectedCallback() {
            this.mutationObserver.disconnect();
        }

        /**
         * Triggered when an observed HTML attribute
         * has been modified (called from `mutationObserverCallback`).
         * @param {string} name - The name of the attribute
         * @param {string} oldValue - The value of the attribute before it was changed
         * @param {string} newValue - The value of the attribute after it is changed
         */
        attributeChangedCallback(name, oldValue, newValue) {
            if (this.isConnected) {
                this.pluginEvt("attributeChanged", [name, oldValue, newValue]);
                switch (name) {

                    case "value":
                        this.value = newValue;
                        break;
                    case "placeholder":
                        this.textareaElement.placeholder = newValue;
                        break;
                    case "template":
                        this.template = codeInput.usedTemplates[newValue || codeInput.defaultTemplate];
                        if (this.template.preElementStyled) this.classList.add("code-input_pre-element-styled");
                        else this.classList.remove("code-input_pre-element-styled");
                        // Syntax Highlight
                        this.update(this.value);

                        break;

                    case "lang":

                        let code = this.codeElement;
                        let mainTextarea = this.textareaElement;

                        // Check not already updated
                        if (newValue != null) {
                            newValue = newValue.toLowerCase();

                            if (code.classList.contains(`language-${newValue}`)) break; // Already updated
                        }


                        // Case insensitive
                        oldValue = oldValue.toLowerCase();

                        // Remove old language class and add new
                        code.classList.remove("language-" + oldValue); // From codeElement
                        code.parentElement.classList.remove("language-" + oldValue); // From preElement
                        code.classList.remove("language-none"); // Prism
                        code.parentElement.classList.remove("language-none"); // Prism

                        if (newValue != undefined && newValue != "") {
                            code.classList.add("language-" + newValue);
                        }

                        if (mainTextarea.placeholder == oldValue) mainTextarea.placeholder = newValue;

                        this.update(this.value);

                        break;
                    default:
                        if (codeInput.textareaSyncAttributes.includes(name)) {
                            if(newValue == null || newValue == undefined) {
                                this.textareaElement.removeAttribute(name);
                            } else {
                                this.textareaElement.setAttribute(name, newValue);
                            }
                        } else {
                            codeInput.textareaSyncAttributes.regexp.forEach((attribute) => {
                                if (name.match(attribute)) {
                                    if(newValue == null) {
                                        this.textareaElement.removeAttribute(name);
                                    } else {
                                        this.textareaElement.setAttribute(name, newValue);
                                    }
                                }
                            });
                        }
                        break;
                }
            }

        }

        /* ------------------------------------
        *  -----------Overrides----------------
        *  ------------------------------------
        * Override/Implement ordinary HTML textarea functionality so that the <code-input>
        * element acts just like a <textarea>. */

        /**
         * @override
         */
        addEventListener(type, listener, options = undefined) {
            let boundCallback = listener.bind(this);
            this.boundEventCallbacks[listener] = boundCallback;

            if (codeInput.textareaSyncEvents.includes(type)) {
                if (options === undefined) {
                    if(this.textareaElement == null) {
                        this.addEventListener("code-input_load", () => { this.textareaElement.addEventListener(type, boundCallback); });
                    } else {
                        this.textareaElement.addEventListener(type, boundCallback);
                    }
                } else {
                    if(this.textareaElement == null) {
                        this.addEventListener("code-input_load", () => { this.textareaElement.addEventListener(type, boundCallback, options); });
                    } else {
                        this.textareaElement.addEventListener(type, boundCallback, options);
                    }
                }
            } else {
                if (options === undefined) {
                    super.addEventListener(type, boundCallback);
                } else {
                    super.addEventListener(type, boundCallback, options);
                }
            }
        }

        /**
         * @override
         */
        removeEventListener(type, listener, options = null) {
            let boundCallback = this.boundEventCallbacks[listener];
            if (type == "change") {
                if (options === null) {
                    this.textareaElement.removeEventListener("change", boundCallback);
                } else {
                    this.textareaElement.removeEventListener("change", boundCallback, options);
                }
            } else if (type == "selectionchange") {
                if (options === null) {
                    this.textareaElement.removeEventListener("selectionchange", boundCallback);
                } else {
                    this.textareaElement.removeEventListener("selectionchange", boundCallback, options);
                }
            } else {
                super.removeEventListener(type, listener, options);
            }
        }

        /**
         * Get the text contents of the code-input element.
         */
        get value() {
            return this._value;
        }
        /**
         * Set the text contents of the code-input element.
         * @param {string} val - New text contents
         */
        set value(val) {
            if (val === null || val === undefined) {
                val = "";
            }
            this._value = val;
            this.update(val);
            return val;
        }

        /**
         * Get the placeholder of the code-input element that appears
         * when no code has been entered.
         */
        get placeholder() {
            return this.getAttribute("placeholder");
        }
        /**
         * Set the placeholder of the code-input element that appears
         * when no code has been entered.
         * @param {string} val - New placeholder
         */
        set placeholder(val) {
            return this.setAttribute("placeholder", val);
        }

        /**
         * Returns a  ValidityState object that represents the validity states of an element.
         * 
         * See `HTMLTextAreaElement.validity`
         */
        get validity() {
            return this.textareaElement.validity;
        }

        /**
         * Returns the error message that would be displayed if the user submits the form, or an empty string if no error message. 
         * It also triggers the standard error message, such as "this is a required field". The result is that the user sees validation 
         * messages without actually submitting.
         * 
         * See `HTMLTextAreaElement.validationMessage`
         */
        get validationMessage() {
            return this.textareaElement.validationMessage;
        }

        /**
         * Sets a custom error message that is displayed when a form is submitted.
         * 
         * See `HTMLTextAreaElement.setCustomValidity`
         * @param error Sets a custom error message that is displayed when a form is submitted.
         */
        setCustomValidity(error) {
            return this.textareaElement.setCustomValidity(error);
        }

        /**
         * Returns whether a form will validate when it is submitted, 
         * without having to submit it.
         * 
         * See `HTMLTextAreaElement.checkValidity`
         */
        checkValidity() {
            return this.textareaElement.checkValidity();
        }

        /**
         * See `HTMLTextAreaElement.reportValidity`
         */
        reportValidity() {
            return this.textareaElement.reportValidity();
        }

        /**
         * Allows plugins to store data in the scope of a single element.
         * Key - name of the plugin
         * Value - object of data to be stored; different plugins may use this differently.
         */
        pluginData = {};

        /**
        * Update value on form reset
        */
        formResetCallback() {
            this.update(this.initialValue);
        };
    },

    arrayWildcards2regex(list) {
        for(let i = 0; i < list.length; i++) {
            const name = list[i];
            if (name.indexOf("*") < 0)
                continue;

            list.regexp.push(new RegExp("^" +
                                name.replace(/[/\-\\^$+?.()|[\]{}]/g, '\\$&')
                                    .replace("*", ".*")
                                + "$", "i"));
            list.splice(i--, 1);
        };
    },

    wildcard2regex(wildcard) {
        if (wildcard.indexOf("*") < 0)
            return null;

        return new RegExp("^" +
                wildcard.replace(/[/\-\\^$+?.()|[\]{}]/g, '\\$&')
                    .replace("*", ".*")
                + "$", "i");
    },

    /** 
     * To ensure the DOM is ready, run this callback after the window 
     * has loaded (or now if it has already loaded)
     */
    runOnceWindowLoaded(callback, codeInputElem) {
        if(codeInput.windowLoaded) {
            callback(); // Fully loaded
        } else {
            window.addEventListener("load", callback);
        }
    },
    windowLoaded: false
}
window.addEventListener("load", function() {
    codeInput.windowLoaded = true;
});


/**
 * convert wildcards into regex
 */

{
    Object.defineProperty(codeInput.textareaSyncAttributes, 'regexp', {
        value: [],
        writable: false,
        enumerable: false,
        configurable: false
    });
    codeInput.observedAttributes = codeInput.observedAttributes.concat(codeInput.textareaSyncAttributes);

    Object.defineProperty(codeInput.observedAttributes, 'regexp', {
        value: [],
        writable: false,
        enumerable: false,
        configurable: false
    });

    codeInput.arrayWildcards2regex(codeInput.textareaSyncAttributes);
    codeInput.arrayWildcards2regex(codeInput.observedAttributes);
}

customElements.define("code-input", codeInput.CodeInput);
