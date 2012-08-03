/*
 * Rapid Interface Builder (RIB) - A simple WYSIWYG HTML5 app creator
 * Copyright (c) 2011-2012, Intel Corporation.
 *
 * This program is licensed under the terms and conditions of the
 * Apache License, version 2.0.  The full text of the Apache License is at
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 */
"use strict";

/*
 * The serialization.js contains following functions:
 *
 *   writeOut():
 *
 */
/*******************************************************
 * General functions for two directions
 ******************************************************/
var DEBUG = true,
    blockActivePageChanged = false,
    xmlserializer = new XMLSerializer(),
    formatHTML  = function (rawHTML) {
        return style_html(rawHTML, {
            'max_char': 80,
            'unformatted': ['a', 'script', 'title']
        });
    },

    /**
     * Generate HTML from ADM tree.
     *
     * @param {ADMNode} design ADM design root to be serialized.
     * @param {function(ADMNode, DOMElement)=} extaHandler Extra handler for each node.
     *
     * @return {Object} return an object contains generated DOM object and related html string
     */
    generateHTML = function (design, extraHandler) {
        design = design || ADM.getDesignRoot();
        var doc = constructNewDocument($.rib.getDefaultHeaders(design));

        function renderer(admNode, domNode) {
            // clean code
            $(domNode).data('uid', admNode.getUid());
            if (domNode.hasClass("rib-remove")) {
                domNode.replaceWith(domNode.text());
            }
            // call extraHandler if needed
            extraHandler && extraHandler(admNode, domNode);
        };

        serializeADMSubtreeToDOM(design, $(doc).find('body'), renderer);
        return { doc: doc,
                 html: formatHTML(xmlserializer.serializeToString(doc))
        };
    },

    getPropertyDomAttribute = function (node, propName, newValue) {
        var attrName, attrMap, attrValue, propValue;
        attrName = BWidget.getPropertyHTMLAttribute(node.getType(), propName);
        propValue = newValue || node.getProperty(propName);
        attrValue = propValue;
        if (typeof attrName === "function") {
            attrValue = attrName(propValue)["value"];
            attrName = attrName(propValue)["name"];
        }
        if (typeof attrName  === "object") {
            attrMap = attrName;
            attrName = attrMap.name;
            if (typeof attrMap.value  === "function")
                attrValue = attrMap.value(propValue);
            else
                attrValue = attrMap.value[propValue];
        }
        return {"name": attrName,
                "value": attrValue};
    },

    serializeADMNodeToDOM = function (node, domParent) {
        var uid, type, pid, selector,
            parentSelector = 'body',
            parentNode = null,
            template, props, id,
            selMap = {},  // maps selectors to attribute maps
            attrObject, propValue,
            widget, regEx, wrapper, domNodes;

        // Check for valid node
        if (node === null || node === undefined ||
            !(node instanceof ADMNode)) {
            return null;
        }

        template = BWidget.getTemplate(node.getType());

        // 1. Regenerating the entire Design, re-create entire document
        if (node.instanceOf('Design')) {
            return null;
        }

        uid = node.getUid();
        type = node.getType();
        selector = '.adm-node[data-uid=\'' + uid + '\']';
        selector += ',.orig-adm-node[data-uid=\'' + uid + '\']';

        if (!node.instanceOf('Page') && !node.instanceOf('Design')) {
            pid = node.getParent().getUid();
            parentSelector = '.adm-node[data-uid="' + pid +
                '"]:not(.delegation),.orig-adm-node[data-uid=\'' + pid + '\']';
        }

        // Find the parent element in the DOM tree
        if (domParent) {
            parentNode = $(domParent);
        } else {
            parentNode = $(':rib-layoutView')
                .layoutView('option','contentDocument').find(parentSelector)
                .last();
        }

        // Find the parent element of this node in the DOM tree
        if (parentNode === undefined || parentNode === null ||
            parentNode.length < 1) {
            // No sense adding it to the DOM if we can't find it's parent
            console.info(parentSelector+' not found in Design View');
        }

        domNodes = $(selector, parentNode);
        // Ensure we have at least something to use as HTML for this item
        if (template === undefined || template === '') {
            console.warn('Missing template for ADMNode type: '+type+
                            '.  Trying defaults...');
            template = defaultTemplates[type];
            // If no default exists, we must error out
            if (template === undefined || template === '') {
                console.error('No template exists for ADMNode type: '+type);
                return null;
            }
        }

        props = node.getProperties();

        if (typeof template === "function") {
            template =  $('<div/>').append(template(node)).html();
        }

        // Apply any special ADMNode properties to the template before we
        // create the DOM Element instance
        for (var p in props) {
            propValue = node.getProperty(p);

            switch (p) {
            case "type":
                break;
            default:
                attrObject = getPropertyDomAttribute(node, p);
                if (attrObject.name) {
                    if (node.isPropertyExplicit(p) ||
                        BWidget.getPropertyForceAttribute(type, p)) {
                        selector = BWidget.getPropertyHTMLSelector(type, p);
                        if (!selector) {
                            // by default apply attributes to first element
                            selector = ":first";
                        }

                        if (!selMap[selector]) {
                            // create a new select map entry
                            selMap[selector] = {};
                        }

                        // add attribute mapping to corresponding selector
                        selMap[selector][attrObject.name] = attrObject.value;
                    }
                }
                break;
            }

            if (typeof propValue === "string" ||
                typeof propValue === "number") {
                // reasonable value to substitute in template
                regEx = new RegExp('%' + p.toUpperCase() + '%', 'g');
                if(typeof propValue === "string") {
                    propValue = propValue.replace(/&/g, "&amp;");
                    propValue = propValue.replace(/"/g, "&quot;");
                    propValue = propValue.replace(/'/g, "&#39;");
                    propValue = propValue.replace(/</g, "&lt;");
                    propValue = propValue.replace(/>/g, "&gt;");
                    // Append UID to assist with debugging
                    if ($.rib.debug('showuid') && p === 'text') {
                        propValue += ' '+uid;
                    }
                }
                template = template.replace(regEx, propValue);
            }
        }

        // Turn the template into an element instance, via jQuery
        widget = $(template);

        // apply the HTML attributes
        wrapper = $("<div>").append(widget);
        for (selector in selMap) {
            wrapper.find(selector)
                .attr(selMap[selector]);
        }

        if (domNodes.length === 0) {
            var zone = BWidget.getZone(node.getParent().getType(), node.getZone());
            if (zone.itemWrapper)
                widget = $(zone.itemWrapper).append(widget);
            if (zone.locator)
                $(parentNode).find(zone.locator).append(widget);
            else
                $(parentNode).append(widget);
        }
        else {
            //The template of some widgets may have multiple root tags
            //and there are also possible delegated nodes, we will remove all
            //the extra nodes before replacing the last one.
            //It's also possible that jQM generates nodes which are not
            //delegating, we should also have a mechanism to handle this case,
            //but till now we don't have such case, so we can defer this case
            //to be handled in the delegate function of the corresponding widget
            //e.g. To add a special class to these tags so that they can be selected
            //to remove here.
            for (var i = 1; i < domNodes.length; i ++)
                $(domNodes[i]).remove();
            $(domNodes[0]).replaceWith(widget);
        }

        return widget;
    },

    serializeADMSubtreeToDOM = function (node, domParent, renderer) {
        var isContainer = false,
            domElement;

        // 1. Only handle ADMNodes
        if (!(node instanceof ADMNode)) {
            return;
        }

        isContainer = (node.getChildrenCount() !== 0);

        // 2. Do something with this node
        domElement = serializeADMNodeToDOM(node, domParent);
        if (renderer && domElement) {
            renderer(node, domElement);
        }

        domElement = domElement || domParent;

        // 3. Recurse over any children
        if (isContainer) {
            var children = node.getChildren();
            for (var i=0; i<children.length; i++) {
                serializeADMSubtreeToDOM(children[i], domElement, renderer);
            }
        }

        // 4. Return (anything?)
        return;
    };
function constructNewDocument(headers) {
    var doc = document.implementation.createHTMLDocument('title'),
        head = $(doc.head),
        tmpHead = '', i;

    if (headers && headers.length > 0) {
        for (i=0; i < headers.length; i++) {
            if (headers[i].match('<script ')) {
                // Need this workaround since appendTo() causes the script
                // to get parsed and then removed from the DOM tree, meaning
                // it will not be in any subsequent Serialization output later
                tmpHead = head[0].innerHTML;
                head[0].innerHTML = tmpHead+headers[i];
            } else {
                $(headers[i]).appendTo(head);
            }
        }
    }

    return doc;
}

function dumplog(loginfo){
    if (DEBUG && (typeof loginfo === "string")){
        console.log(loginfo);
    }
    return;
}


$(function() {
    /*******************************************************
     * JSON to ADM Direction
     ******************************************************/
    /**
     * Loads a design from a JSON object and replaces the design root. Sets the
     * AMD design root to this design, which sends a designReset event.
     *
     * @param {Object} obj The JSON object to parse
     * @param {function(ADMNode, Object)=} eachHandler Extra handler for each pair of
     *                                                 ADM node and the related object.
     *
     * @return {ADMNode/null} the design build from the text if success, null if failed.
     */
    function JSONToProj(text, eachHandler) {
        var result, design, parsedObject, resultProject = {}, JSObjectToADMNode;

        JSObjectToADMNode = function (admNode, jsObject) {
            var children, child, zone,
                properties, childNode,
                item, val, result, i;

            if ((typeof jsObject !== "object") || !(admNode instanceof ADMNode)) {
                return false;
            }
            try {
                if (jsObject.properties) {
                    properties = jsObject.properties;
                    // Set properties for current ADM node
                    for (item in jsObject.properties) {
                        // Parse properties and set the value to the node
                        val = properties[item];
                        // If we can't get value, we set item's value as default
                        if (val){
                            // NOTE: It's important that we pass "true" for the fourth
                            // parameter here (raw) to disable "property hook"
                            // functions like the grid one that adds or removes child
                            // Block elements based on the property change
                            admNode.setProperty(item, val, null, true);
                        }
                    }
                }
                if (jsObject.children) {
                    // Scan children nodes
                    children = jsObject.children;
                    for (i = 0; i < children.length; i++) {
                        child = children[i];
                        zone = child.zone || "default";
                        childNode = ADM.createNode(child.type, true);

                        // Add child node to current node
                        if (!admNode.addChildToZone(childNode, zone)) {
                            dumplog("add child type "+ child.type + " failed");
                            return false;
                        }
                        result = JSObjectToADMNode(childNode, child);
                        if (!result) {
                            return false;
                        }
                    }
                }
            }catch (e) {
                if (!confirm("Error when " + (i ? " adding new child '" +
                             child.type + "'" : "setting property '" +
                             item + "'") + " - " + e +
                            ".\n\nContinue loading the design?"))
                    return false;
            }
            // Call extra handler for each relative pair
            eachHandler && eachHandler(admNode, jsObject);
            return true;
        };
        /************************ JSObjectToADMNode function end *************************/

        try {
            parsedObject = $.parseJSON(text);
        } catch(e) {
            parsedObject = null;
            alert("Invalid design file.");
        }
        if (parsedObject === null || parsedObject.type !== "Design") {
            console.log("obj is null or is not a 'Design' Node");
            return null;
        }

        design = new ADMNode("Design");
        design.suppressEvents(true);

        // Add children in ADM
        try {
            result = JSObjectToADMNode(design, parsedObject);
        } catch(e) {
            result = null;
            alert("Invalid design file.");
        }

        design.suppressEvents(false);

        if (result) {
            resultProject.design = design;
            resultProject.pInfo = parsedObject.pInfo;
            return resultProject;
        } else {
            console.error("Error while building design root from JSON");
            return null;
        }
    }

    /*******************************************************
     * ADM to JSON Direction
     ******************************************************/
    /**
     * Serialize ADMTree to an common javascript Object.
     *
     * @param {ADMNode} ADMTreeNode ADM node to be serialized.
     * @param {function(ADMNode, Object)=} handler Extra handler for each pair of
     *                                             ADM node and the related object.
     * @return {Boolean} return the serialized Object if success, null when fails
     */
    function ADMToJSONObj(ADMTreeNode, handler) {
        ADMTreeNode = ADMTreeNode || ADM.getDesignRoot();
        if (ADMTreeNode instanceof ADMNode) {
            // Save staff in ADMNode
            var JSObject = {},
                children, i, props, zone;
            JSObject.type = ADMTreeNode.getType();
            zone = ADMTreeNode.getZone();
            if (zone !== "default") {
                JSObject.zone = zone;
            }
            props = ADMTreeNode.getExplicitProperties();
            // If there are some explicit properties
            if (typeof props === "object" && Object.keys(props).length > 0) {
                JSObject.properties = props;
            }

            // Recurse to fill children array
            children = ADMTreeNode.getChildren();
            if (children.length > 0) {
                JSObject.children = [];
                for (i = 0; i < children.length; i++) {
                    JSObject.children[i] = ADMToJSONObj(children[i], handler);
                }
            }
            // Run handler to handle every node
            handler && handler(ADMTreeNode, JSObject);
            return JSObject;
        } else {
            console.log("warning: children of ADMNode must be ADMNode");
            return null;
        }
    }

    function getDefaultHeaders(design) {
        var i, props, el, designRoot;
        designRoot = design || ADM.getDesignRoot();

        $.rib.defaultHeaders = $.rib.defaultHeaders || [];

        if ($.rib.defaultHeaders.length > 0)
            return $.rib.defaultHeaders;

        props = designRoot.getProperty('metas');
        for (i in props) {
            // Skip design only header properties
            if (props[i].hasOwnProperty('designOnly') && props[i].designOnly) {
                continue;
            }
            el = '<meta ';
            if (props[i].hasOwnProperty('key')) {
                el = el + props[i].key;
            }
            if (props[i].hasOwnProperty('value')) {
                el = el + '="' + props[i].value + '"';
            }
            if (props[i].hasOwnProperty('content')) {
                el = el + ' content="' + props[i].content + '"';
            }
            el = el + '>';
            $.rib.defaultHeaders.push(el);
        }
        props = designRoot.getProperty('libs');
        for (i in props) {
            // Skip design only header properties
            if (props[i].hasOwnProperty('designOnly') && props[i].designOnly) {
                continue;
            }
            el = '<script ';
            if (props[i].hasOwnProperty('value')) {
                el = el + 'src="' + props[i].value + '"';
            }
            el = el + '></script>';
            $.rib.defaultHeaders.push(el);
        }
        props = designRoot.getProperty('css');
        for (i in props) {
            // Skip design only header properties
            if (props[i].hasOwnProperty('designOnly') && props[i].designOnly) {
                continue;
            }
            el = '<link ';
            if (props[i].hasOwnProperty('value')) {
                el = el + 'href="' + props[i].value + '"';
            }
            el = el + ' rel="stylesheet">';
            $.rib.defaultHeaders.push(el);
        }
        return $.rib.defaultHeaders;
    }

    // create a notice Dialog for user to configure the browser, so that
    // a native dialog can be shown when exporting design or HTML code
    function  createExportDialog () {
        var dialogOpts, exportTypes, exportDialog, cookieExpires,
            exportMenu, cancelDiv, configNotice, checkbox;
        exportTypes = ['zip', 'json', 'wgt'];
        cookieExpires = new Date("January 1, 2042");
        dialogOpts = {
            autoOpen: true,
            modal: true,
            width: 500,
            resizable: false,
            height: 150,
            title: "Export"
        };
        exportDialog = $('<div id="exportDialog" />').addClass("vbox");

        // If user haven't checked "Do not remind again", then show the notice
        if ($.rib.cookieUtils.get("exportNotice") !== "false") {
            // Resize the dialog
            dialogOpts.height *= 2;
            // Add configure notice
            configNotice = $('<div class="flex2" />').appendTo(exportDialog);
            $('<p><b>Note:  </b>File will be saved in the default download path.</p>'
                    + '<div>Please configure the browser to ask for saving location,<br />'
                    + 'for Chrome, go to Settings: <em>chrome://chrome/settings/</em><br />'
                    + 'and check the option to be asked where to save download files.</div>'
                    + '<div><br /><input type="checkbox">&nbsp<a>Do not remind me again<a></div>'
             ).appendTo(configNotice);
            checkbox = configNotice.find('input:checkbox');
            checkbox.change(function () {
                var notice = this.checked ? "false" : "true";
                // set cookie
                if(!$.rib.cookieUtils.set("exportNotice", notice, cookieExpires)) {
                    console.error("Set exportNotice cookie failed.");
                }
            });
            checkbox.next('a').click(function () {
                $(this).prev("input:checkbox").click(); });
        }

        // Add elements about selecting export type
        exportMenu = $('<div align="center" id="export-menu" />');
        cancelDiv = $('<div align="right"/>').append($('<button />').text("Cancel")
            .addClass("buttonStyle")
            .click(function () { exportDialog.dialog('close');}));
        $('<div />').addClass('flex1')
            .append('<div>Export project as:</div>')
            .append(exportMenu)
            .append(cancelDiv)
            .appendTo(exportDialog);
        $.each(exportTypes, function (index, type) {
            $('<button />').attr('id', 'export-' + type)
                .text(type)
                .addClass("buttonStyle")
                .appendTo(exportMenu);
        });

        exportDialog.dialog(dialogOpts);
        return exportDialog;
    }

    function  exportFile (fileName, content, binary) {
        $.rib.fsUtils.write(fileName, content, function(fileEntry){
            $.rib.fsUtils.exportToTarget(fileEntry.fullPath);
        }, null, false, binary);
    }

    function getConfigFile (pid, iconPath) {
        var projName, xmlHeader, xmlDoc, widget, childNode;
        projName = $.rib.pmUtils.getProperty(pid, "name") || "Untitled";
        // TODO: Ask user for following config data
        xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
        xmlDoc = $.parseXML('<widget xmlns="http://www.w3.org/ns/widgets" />');
        widget = xmlDoc.getElementsByTagName('widget')[0];
        // add the attr to widget
        widget.setAttribute('xmlns:tizen', 'http://tizen.org/ns/widgets');
        widget.setAttribute('version', '0.1');
        widget.setAttribute('viewmodes', 'fullscreen');
        widget.setAttribute('id', 'http://yourdomain/' + projName);

        // add name to the widget
        childNode = xmlDoc.createElement('name');
        childNode.appendChild(xmlDoc.createTextNode(projName));
        widget.appendChild(childNode);

        // add icon to the widget
        childNode = xmlDoc.createElement('icon');
        childNode.setAttribute('src', iconPath);
        widget.appendChild(childNode);
        return (xmlHeader + xmlserializer.serializeToString(xmlDoc));
    }

    function getNeededFiles () {
        var files = [
            'src/css/images/ajax-loader.png',
            'src/css/images/icons-18-white.png',
            'src/css/images/icons-36-white.png',
            'src/css/images/icons-18-black.png',
            'src/css/images/icons-36-black.png',
            'src/css/images/icon-search-black.png',
        ];

        function getDefaultHeaderFiles (type) {
            var headers, files = [];
            headers = ADM.getDesignRoot().getProperty(type);
            for ( var header in headers) {
                // Skip design only header properties
                if (headers[header].hasOwnProperty('designOnly') && headers[header].designOnly) {
                    continue;
                }
                files.push(headers[header].value);
            }
            return files;
        }
        // Add js Files
        $.merge(files, getDefaultHeaderFiles("libs"));
        // Add css Files
        $.merge(files, getDefaultHeaderFiles("css"));
        return files;
    }

    function  createZipAndExport(pid, ribFile, type) {
        var zip, projName, resultHTML, resultConfig, files, i, iconPath;
        zip = new JSZip();
        files = getNeededFiles();
        // Get the project Name
        projName = $.rib.pmUtils.getProperty(pid, "name") || "Untitled";
        // If the type is "wgt" then add config.xml and icon
        if (type === 'wgt') {
            // TODO: get icon from pInfo
            iconPath = 'src/assets/rib-48.png';
            resultConfig = getConfigFile(pid, iconPath);
            resultConfig && zip.add("config.xml", resultConfig);
            files.push(iconPath);
        }
        ribFile && zip.add(projName + ".json", ribFile);
        resultHTML = generateHTML(null, function (admNode, domNode) {
            var urlPath, projectDir, matched, p;
            matched = admNode.getMatchingProperties($.rib.pmUtils.relativeFilter);
            projectDir = $.rib.pmUtils.ProjectDir + "/" + pid + "/";
            // Add uploaded images to the needed list
            for (p in matched) {
                urlPath = $.rib.fsUtils.pathToUrl(projectDir + matched[p].replace(/^\//, ""));
                files.push({
                    "src": urlPath,
                    "dst": matched[p]
                });
            }
        });
        resultHTML && zip.add("index.html", resultHTML.html);
        // projName now is the whole package name
        projName = projName + '.' + type;

        i = 0;
        files.forEach(function (file, index) {
            var req, srcPath, dstPath;
            // We have to do ajax request not using jquery as we can't get "arraybuffer" response from jquery
            var req = window.ActiveXObject ? new window.ActiveXObject( "Microsoft.XMLHTTP" ): new XMLHttpRequest();
            req = window.ActiveXObject ? new window.ActiveXObject( "Microsoft.XMLHTTP" ): new XMLHttpRequest();
            if ((typeof file === "object") && file.dst && file.src) {
                srcPath = file.src;
                dstPath = file.dst;
            } else if (typeof file === "string") {
                srcPath = file;
                dstPath = file;
            } else {
                console.error("Invalid path for exported zipfile.");
                return;
            }
            req.onload = function() {
                var uIntArray = new Uint8Array(this.response);
                var charArray = new Array(uIntArray.length);
                for (var j = 0; j < uIntArray.length; j ++) {
                    charArray[j] = String.fromCharCode(uIntArray[j]);
                }
                zip.add(dstPath, btoa(charArray.join('')), {base64:true});
                if (i === files.length - 1){
                    var content = zip.generate(true);
                    exportFile(projName, content, true);
                }
                i++;
            }
            try {
                req.open("GET", srcPath, true);
                req.responseType = 'arraybuffer';
            } catch (e) {
                alert(e);
            }
            req.send(null);
        });
    }

    function exportPackage (ribFile) {
        var exportDialog, pid;
        pid = pid || $.rib.pmUtils.getActive();

        exportDialog = createExportDialog();
        exportDialog.find("button#export-json").click(function () {
            // Get the project Name
            var projName = $.rib.pmUtils.getProperty(pid, "name") || "Untitled";
            projName = projName + '.json';
            exportFile(projName, ribFile);
            exportDialog.dialog('close');
        });
        exportDialog.find("button#export-wgt").click(function () {
            createZipAndExport(pid, ribFile, 'wgt');
            exportDialog.dialog('close');
        });
        exportDialog.find("button#export-zip").click(function () {
            createZipAndExport(pid, ribFile, 'zip');
            exportDialog.dialog('close');
        });
        return;
    }

    /***************** export functions out *********************/
    $.rib.useSandboxUrl = function (admNode, domNode) {
        var projectDir, urlPath, matched, p, attrObject, pid;
        // Get the specified properties by uploaded relative filter
        matched = admNode.getMatchingProperties($.rib.pmUtils.relativeFilter);
        pid = $.rib.pmUtils.getActive();
        if (!pid) {
            return;
        }
        projectDir = $.rib.pmUtils.ProjectDir + "/" + pid + "/";

        // Change the attributes of the DOM
        for (p in matched) {
            urlPath = $.rib.fsUtils.pathToUrl(projectDir + matched[p].replace(/^\//, ""));
            attrObject = getPropertyDomAttribute(admNode, p, urlPath);
            // Set the new value for the domNode
            if (attrObject && attrObject.name && attrObject.value) {
                $(domNode).attr(attrObject.name, attrObject.value);
            }
        }
        return;
    };
    // Export serialization functions into $.rib namespace
    $.rib.ADMToJSONObj = ADMToJSONObj;
    $.rib.JSONToProj = JSONToProj;
    $.rib.getDefaultHeaders = getDefaultHeaders;
    $.rib.exportPackage = exportPackage;
});
