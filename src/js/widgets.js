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

/**
 * BWidgetRegistry is private data, you should access it through BWidget
 *
 * Top-level object with properties representing all known widgets
 * Each property should be an object with:
 *   1)        parent: string name of inherited parent object
 *   2) showInPalette: boolean for user-exposed widgets (default true)
 *   3)    properties: an object with property name keys and type string values,
 *                     (see details below)
 *   4)      template: a string for code to generate for this widget, or a
 *                     function to be called to generate code
 *   5)         zones: an array of places where the widget can contain children,
 *                     (see details below)
 *   6)       allowIn: a string or array of strings - the widgets that are
 *                     allowed to contain this widget (e.g. a Block should only
 *                     go in a Grid, even though Page Content allows any child)
 *   7)    selectable: boolean, currently poorly named, seemingly means whether
 *                     to show it in the outline view or not (default: true)
 *   8)      moveable: boolean, whether it should be draggable in the design
 *                     canvas (default: true)
 *   9)      redirect: an object containing zone string and type string; if a
 *                     widget is attempted to be added to this widget, instead
 *                     add it to the given zone, inside the widget type
 *                     (first creating that widget if it doesn't exist)
 *  10)      newGroup: [DEPRECATED] boolean, indicating that this is the first
 *                     widget in a conceptual group of widgets (default: false),
 *                     this should go away soon in favor of a better system for
 *                     classifying/presenting widgets
 *  11)  newAccordion: [DEPRECATED] boolean, indicating that this is the first
 *                     widget within a new high-level widget set (default:
 *                     false), should go away soon (see newGroup above)
 *  12)  displayLabel: the name to be displayed to the user for this widget, if
 *                     different from the raw name (eventually this should be
 *                     overwritten by localized values)
 *  13)      delegate: [FIXME] something to do with which node in the generated
 *                     template is used for event handling (string or function)
 *  14)        events: [FIXME] something to do with handling events
 *  15)          init: function to be called after a new widget is created with
 *                     default properties, e.g. when dragged onto the canvas
 *                     from the palette (i.e. Grid uses this to generate its
 *                     two default child Blocks)
 *  16)  outlineLabel: optional function(ADMNode) that returns a label to show
 *                     (intended even for widgets w/ showInPalette false)
 *  17)      editable: optional object, containing an optional selector and a
 *                     a required property name (see #3 above).  Existance of
 *                     this object implies the textContent node of the
 *                     resulting DOM element is editable in-line
 *
 * Each zone description in the array should be an object with:
 *   1) name identifying the zone point
 *   2) cardinality, either "1" or "N" representing number of contained items
 *   3) allow: string or array of string names of allowable widgets
 *               (all others will be denied)
 *   4) deny: string or array of string names of disallowed widgets
 *             (all others will be allowed)
 *   Only one of allow or deny should be set, if neither than all are allowed.
 *
 * The "properties" of each widget definition is an object, each property of
 * which names a property of the widget. These are objects with the following
 * fields:
 *   1)            type: one of "boolean", "integer", "string", or "array" for
 *                       now
 *   2)    defaultValue: optional default value for the property, of the type
 *                       specified above
 *   3)   htmlAttribute: optional string with an HTML attribute name that this
 *                       property should be written to
 *   4)  forceAttribute: if true, always write out the HTML attribute even when
 *                       it is equal to the default value (default: false)
 *   5)    htmlSelector: optional selector to find the DOM nodes on which to
 *                       apply the HTML attribute (default: root node returned
 *                       by the template for this widget)
 *   6)    autoGenerate: "string" prefix for automatically assigning unique
 *                       values (only valid for string type)
 *   7)         options: An array of the only valid values for this property,
 *                       to be selected from a dropdown rather than freely
 *                       entered
 *   8) setPropertyHook: optional function to be called when a property is
 *                       about to change, giving the widget an opportunity to
 *                       modify its children (e.g. grid rows or columns change)
 *                       Takes the ADM node, the new property value, and a
 *                       transactionData object. The function returns a
 *                       transactionData object, if necessary, to track what
 *                       additional info would be needed to undo/redo this
 *                       transaction. If later the hook is passed this data
 *                       back, it should make use of it to undo/redo the
 *                       property change appropriately. (E.g. when grid rows
 *                       is lowered, it saves the removed Blocks in an array
 *                       by returning this data, then if called again with
 *                       that same data, it restores them. If rows went from
 *                       5 to 3 originally and you returned data X, you're
 *                       guaranteed that if you see data X again, you will be
 *                       going from 3 to 5 rows, and can make sense of the
 *                       data.)
 *
 * @class
 */
var BWidgetRegistry = {
    /**
     * "Base class" for other widget types, with an "id" string property.
     */
    Base: {
        parent: null,
        allowIn: [],
        applyProperties: function (node, code) {
            var id = node.getProperty("id");
            if (id && node.isPropertyExplicit("id")) {
                code.attr("id", id);
            }
            return code;
        },
        showInPalette: false,
        selectable: false,
        moveable: false,
        properties: {
            id: {
                type: "string",
                defaultValue: "",
                htmlAttribute: "id"
            }
        }
    },

    /**
     * The root object for a user's application design.
     */
    Design: {
        parent: "Base",
        allowIn: [],
        showInPalette: false,
        selectable: false,
        moveable: false,
        properties: {
            metas: {
                type: "array",
                defaultValue: [
                    { key:'name',
                      value: 'viewport',
                      content: 'width=device-width, initial-scale=1'
                    },
                    { designOnly: true,
                      key:'http-equiv',
                      value: 'cache-control',
                      content: 'no-cache'
                    },
                ]
            },
            libs: {
                type: "array",
                defaultValue: [
                    { designOnly: false,
                      value: 'lib/jquery-1.6.4.js'
                    },
                    { designOnly: true,
                      value: 'lib/jquery-ui-1.8.16.custom.js'
                    },
                    { designOnly: true,
                      value: 'src/js/template.js'
                    },
                    { designOnly: false,
                      value: 'lib/jquery.mobile-1.0.js'
                    },
                    { designOnly: false,
                      value: 'lib/web-ui-fw-libs.js'
                    },
                    { designOnly: false,
                      value: 'lib/web-ui-fw.js'
                    }
                ]
            },
            css: {
                type: "array",
                defaultValue: [
                    { designOnly: false,
                      value: 'src/css/jquery.mobile.structure-1.0.css'
                    },
                    { designOnly: false,
                      value: 'src/css/jquery.mobile-1.0.css'
                    },
                    { designOnly: false,
                      value: 'src/css/web-ui-fw-theme.css'
                    },
                    { designOnly: false,
                      value: 'src/css/web-ui-fw-widget.css'
                    },
                    { designOnly: true,
                      value: 'src/css/template.css'
                    }
                ]
            }
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: "Page"
            }
        ],
    },

    /**
     * Represents a page or dialog in the application. Includes "top" zone
     * for an optional header, "content" zone for the Content area, and "bottom"
     * zone for an optional footer.
     */
    Page: {
        parent: "Base",
        allowIn: "Design",
        template: function (node) {
            var prop, code = $('<div data-role="page"></div>');
            code.attr("id", node.getProperty("id"));

            // don't write data-theme if it's using the default
            prop = node.getProperty("theme");
            if (prop !== "default") {
                code.attr("data-theme", prop);
            }
            return code;
        },

        showInPalette: false,
        selectable: true,
        moveable: false,
        properties: {
            id: {
                type: "string",
                autoGenerate: "page"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
            }
        },
        redirect: {
            zone: "content",
            type: "Content"
        },
        zones: [
            {
                name: "top",
                cardinality: "1",
                allow: "Header"
            },
            {
                name: "content",
                cardinality: "1",
                allow: "Content"
            },
            {
                name: "bottom",
                cardinality: "1",
                allow: "Footer"
            }
        ],
    },

    /**
     * Represents a header object at the top of a page. Includes a "text"
     * property that represents header text. Includes "left" and "right" zones
     * for optional buttons, and "bottom" zone for an optional navbar.
     */
    Header: {
        parent: "Base",
        allowIn: "Page",
        dragHeader: true,
        paletteImageName: "jqm_header.svg",
        template: function (node) {
            var prop, code = $('<div data-role="header"><h1></h1></div>');
            code = BWidgetRegistry.Base.applyProperties(node, code);

            // only write data-position if it's being set to fixed
            if (node.getProperty("position") === "fixed") {
                code.attr("data-position", "fixed");
            }

            // don't write data-theme if it's using the default
            prop = node.getProperty("theme");
            if (prop !== "default") {
                code.attr("data-theme", prop);
            }

            // always write the title
            code.find("h1")
                .text(node.getProperty("text"));
            return code;
        },

        moveable: false,
        editable: {
            selector: "h1",
            propertyName: "text"
        },
        properties: {
            text: {
                type: "string",
                defaultValue: "Header"
            },
            position: {
                type: "string",
                options: [ "default", "fixed" ],
                defaultValue: "default",
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
            }
        },
        zones: [
            {
                name: "left",
                cardinality: "1",
                allow: "Button"
            },
            {
                name: "right",
                cardinality: "1",
                allow: "Button"
            },
            {
                name: "bottom",
                cardinality: "1",
                allow: "Navbar, OptionHeader"
            }
        ],
    },

    /**
     * Represents a footer object at the bottom of a page.
     */
    Footer: {
        parent: "Base",
        allowIn: "Page",
        dragHeader: true,
        paletteImageName: "jqm_footer.svg",
        template: function (node) {
            var prop, code = $('<div data-role="footer"></div>');
            code = BWidgetRegistry.Base.applyProperties(node, code);

            // only write data-position if it's being set to fixed
            if (node.getProperty("position") === "fixed") {
                code.attr("data-position", "fixed");
            }

            // don't write data-theme if it's using the default
            prop = node.getProperty("theme");
            if (prop !== "default") {
                code.attr("data-theme", prop);
            }

            // write the text if non-empty
            prop = node.getProperty("text");
            if (prop) {
                code.append('<h1>' + prop + '</h1>');
            }
            return code;
        },

        moveable: false,
        editable: {
            selector: "h1",
            propertyName: "text"
        },
        properties: {
            text: {
                type: "string",
                defaultValue: "Footer",
            },
            position: {
                type: "string",
                options: [ "default", "fixed" ],
                defaultValue: "default",
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
            }
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
                // deny Slider widgets because they render poorly; this may be
                // a bug in jQuery Mobile
                deny: "Slider"
            }
        ],
    },

    /**
     * Represents the main content area of a page (between the header and
     * footer, if present).
     */
    Content: {
        parent: "Base",
        allowIn: "Page",
        showInPalette: false,
        selectable: false,
        moveable: false,
        template: '<div data-role="content"></div>',
        zones: [
            {
                name: "default",
                cardinality: "N"
            }
        ],
    },

    /**
     * Represents a Control Group object. Includes an "data-type" property
     * that should be "vertical" or "horizontal"
     */
    ButtonGroup: {
        parent: "Base",
        dragHeader: true,
        paletteImageName: "jqm_vertical_button_group.svg",
        template: '<div data-role="controlgroup"></div>',
        newGroup: true,
        displayLabel: "Button Group",
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: "Button"
            }
        ],
        properties: {
            // TODO: Look into why, if this property is renamed "type",
            //       the ButtonGroup goes crazy and doesn't work
            orientation: {
                type: "string",
                options: [ "vertical", "horizontal" ],
                defaultValue: "vertical",
                htmlAttribute: "data-type"
            }
        },
        init: function (node) {
            // initial state is three buttons
            var i;
            for (i = 0; i < 3; i++) {
                node.addChild(new ADMNode("Button"));
            }
        }
    },

    /**
     * Represents a button. A "text" string property holds the button text.
     */
    Button: {
        parent: "Base",
        paletteImageName: "jqm_button.svg",
        editable: {
            selector: "span > .ui-btn-text",
            propertyName: "text"
        },
        properties: {
            text: {
                type: "string",
                defaultValue: "Button"
            },
            target: {
                type: "string",
                defaultValue: "",
                htmlAttribute: "href"
            },
            icon: {
                type: "string",
                options: [ "none", "alert", "arrow-d", "arrow-l", "arrow-r",
                           "arrow-u", "back", "check", "delete", "forward",
                           "gear", "grid", "home", "info", "minus", "plus",
                           "refresh", "search", "star" ],
                defaultValue: "none",
                htmlAttribute: "data-icon"
            },
            iconpos: {
                type: "string",
                options: [ "left", "top", "bottom", "right", "notext" ],
                defaultValue: "left",
                htmlAttribute: "data-iconpos"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            },
            inline: {
                type: "boolean",
                defaultValue: "false",
                htmlAttribute: "data-inline"
            },
            transition: {
                type: "string",
                options: [ "slide", "slideup", "slidedown", "pop", "fade", "flip" ],
                defaultValue: "slide",
                htmlAttribute: "data-transition"
            }
        },
        template: '<a data-role="button">%TEXT%</a>'
    },

    /**
     * Represents an HTML form object. Includes an "action" property with the
     * submission URL and a "method" string property that should be "get" or
     * "post".
     */
    Form: {
        // FIXME: I'm not positive that forms should be widgets. We could
        //        alternately make forms a separate concept, the user can pick
        //        a form for each widget to be associated with in properties,
        //        for example. Need to look at this.
        parent: "Base",
        dragHeader: true,
        paletteImageName: "jqm_form.svg",
        template: '<form></form>',
        newGroup: true,
        zones: [
            {
                name: "default",
                cardinality: "N"
            }
        ],
        properties: {
            action: {
                type: "string",
                defaultValue: "http://",
                htmlAttribute: "action",
                forceAttribute: true
            },
            method: {
                type: "string",
                options: [ "GET", "POST" ],
                defaultValue: "POST",
                htmlAttribute: "method",
                forceAttribute: true
            }
        }
    },

    /**
     * Represents a slider widget for selecting from a range of numbers.
     * Includes "min" and "max" number properties that define the range, and
     * a "value" property that defines the default.
     */
    Slider: {
        parent: "Base",
        paletteImageName: "jqm_slider.svg",
        properties: {
            // TODO: What's this for? wouldn't text be in an associated label?
            //       Document above.
            id: {
                type: "string",
                autoGenerate: "slider"
            },
            label: {
                type: "string",
                defaultValue: ""
            },
            value: {
                type: "integer",
                defaultValue: 50
            },
            min: {
                type: "integer",
                defaultValue: 0
            },
            max: {
                type: "integer",
                defaultValue: 100
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default"
            },
            track: {
                displayName: "track theme",
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default"
            }
        },
        editable: {
            selector: "label",
            propertyName: "label"
        },
        template: function (node) {
            var label, idstr, prop, input,
                code = $('<div data-role="fieldcontain"></div>');

            prop = node.getProperty("id");
            idstr = prop + "-range";

            label = node.getProperty("label");
            code.append($('<label for="$1">$2</label>'
                          .replace(/\$1/, idstr)
                          .replace(/\$2/, label||"")));

            input = $('<input type="range">');
            input.attr("id", idstr);

            prop = node.getProperty("value");
            input.attr("value", prop);

            prop = node.getProperty("min");
            input.attr("min", prop);

            prop = node.getProperty("max");
            input.attr("max", prop);

            prop = node.getProperty("theme");
            if (prop !== "default") {
                input.attr("data-theme", prop);
            }

            prop = node.getProperty("track");
            if (prop !== "default") {
                input.attr("data-track-theme", prop);
            }

            code.append(input);
            return code;
        }
    },

    /**
     * Represents a text label. A "text" string property holds the text.
     */
    Label: {
        // FIXME: I'm not sure we should really have this. Instead we make
        //        label text a property of other form elements and the
        //        <label> part of their templates.
        parent: "Base",
        paletteImageName: "jqm_label.svg",
        properties: {
            text: {
                type: "string",
                defaultValue: "Label"
            }
        },
        editable: {
            selector: "",
            propertyName: "text"
        },
        template: '<label>%TEXT%</label>',
    },

    /**
     * Represents a text entry.
     */
    TextInput: {
        parent: "Base",
        displayLabel: "Text Input",
        paletteImageName: "jqm_text_input.svg",
        editable: {
            selector: "",
            propertyName: "value"
        },
        properties: {
            hint: {
                type: "string",
                defaultValue: "",
                htmlAttribute: "placeholder"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            },
            value: {
                // FIXME: Probably value should be removed, setting initial
                //        static text is not a common thing to do
                type: "string",
                defaultValue: "",
                htmlAttribute: "value"
            }
        },
        template: '<input type="text">',
    },

    /**
     * Represents a text area entry.
     */
    TextArea: {
        // FIXME: good form is to include a <label> with all form elements
        //        and wrap them in a fieldcontain
        parent: "Base",
        displayLabel: "Text Area",
        paletteImageName: "jqm_text_area.svg",
        editable: {
            selector: "",
            propertyName: "value"
        },
        properties: {
            hint: {
                type: "string",
                defaultValue: "",
                htmlAttribute: "placeholder"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            },
            value: {
                // FIXME: Probably value should be removed, setting initial
                //        static text is not a common thing to do
                type: "string",
                defaultValue: "",
            }
        },
        template: '<textarea>%VALUE%</textarea>'
    },

    /**
     * Represents a toggle switch.
     */
    ToggleSwitch: {
        parent: "Base",
        displayLabel: "Toggle Switch",
        paletteImageName: "jqm_toggle_switch.svg",
        properties: {
            value1: {
                type: "string",
                defaultValue: "off"
            },
            label1: {
                type: "string",
                defaultValue: "Off"
            },
            value2: {
                type: "string",
                defaultValue: "on"
            },
            label2: {
                type: "string",
                defaultValue: "On"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            }
        },
        template: '<select data-role="slider"><option value="%VALUE1%">%LABEL1%</option><option value="%VALUE2%">%LABEL2%</option></select>',
        // jQM generates an div next to the slider, which is the actually clicked item when users try to click the flip toggle switch.
        delegate:"next",
    },

    /**
     * Represents a select element.
     */
    SelectMenu: {
        parent: "Base",
        paletteImageName: "jqm_select.svg",
        template: function(node) {
            var prop, length, i, child,
            code = $('<select></select>');
            prop = node.getProperty("options");
            length = prop.children.length;
            for (i = 0; i< length; i++) {
                child = prop.children[i];
                $('<option value="' + child.value + '">'+ child.text + '</option>')
                    .appendTo(code);
            }
            return code;
        },
        init: function (node) {
            // initial state is three radio buttons
            var i, prop, optionItem;
            prop = node.getProperty("options");
            prop.children = [];
            for (i = 0; i < 3; i++) {
                optionItem = {};
                optionItem.text = "Option" + (i+1);
                optionItem.value = "Value";
                prop.children.push(optionItem);
            }
        },
        newGroup: true,
        displayLabel: "Select Menu",
        properties: {
            options: {
                 type: "record-array",
                 sortable: true,
                 recordType: {
                     text: "string",
                     value: "string"
                 },
                 children : [],
                 defaultValue: {
                     type:  "record-array",
                     sortable: true,
                     recordType: {
                         text: "string",
                         value: "string"
                     },
                     children : []
                 }
             }
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: [ "Option" ]
            }
        ],
        //jQM generates two levels of divs for a select, the topmost one is what is clicked.
        delegate: "grandparent",
        events: {
            mousedown: function (e) {
                e.preventDefault();
            },
            click: function (e) {
                e.stopPropagation();
                return this.ownerDocument.defaultView.handleSelect(e, $(this).parent().parent()[0]);
            }
        }
    },

    /**
     * Represents an option element.
     */
    Option: {
        parent: "Base",
        allowIn: "SelectMenu",
        showInPalette: false,
        selectable: false,
        moveable: false,
        properties: {
            text: {
                type: "string",
                defaultValue: "Option"
            },
            value: {
                type: "string",
                defaultValue: ""
            }
        },
        template: '<option>%TEXT%</option>'
    },

    /**
     * Represents a Radio Group object.
     */
    RadioGroup: {
        parent: "ButtonGroup",
        dragHeader: true,
        newGroup: true,
        displayLabel: "Radio Group",
        paletteImageName: "jqm_radio_group.svg",
        properties: {
            // FIXME: Put fieldcontain back in here, but will require
            //        support for selector on HTML attribute for data-type

            // FIXME: Before the legend was not written if with-legend was
            //        "no" -- instead, we could just check for empty legend
            //        in a template function, like I did in Slider in this
            //        commit. But it seems to work fine with a blank
            //        legend, so maybe it makes sense to always write to
            //        guide the user as they edit the HTML.
            legend: {
               type: "string",
               defaultValue: ""
            },
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: [ "RadioButton" ]
            }
        ],
        template: '<fieldset data-role="controlgroup"><legend>%LEGEND%</legend></fieldset>',
        init: function (node) {
            // initial state is three radio buttons
            var i, button;
            for (i = 0; i < 3; i++) {
                button = new ADMNode("RadioButton");
                node.addChild(button);
                if (i == 0) {
                    button.setProperty("checked", true);
                }
            }
        },
    },

    /**
     * Represents an radio button element.
     */
    RadioButton: {
        parent: "Base",
        displayLabel: "Radio Button",
        paletteImageName: "jqm_radio_button.svg",
        allowIn: "RadioGroup",
        editable: {
            selector: "span > .ui-btn-text",
            propertyName: "label"
        },
        properties: {
            // FIXME: All the radio buttons in a group need to have a common
            //        "name" field in order to work correctly
            id: {
                type: "string",
                autoGenerate: "radio",
                htmlAttribute: "id"
            },
            label: {
                type: "string",
                defaultValue: "Radio Button"
            },
            value: {
                type: "string",
                defaultValue: "",
                htmlAttribute: "value"
            },
            checked: {
                type: "string",
                options: [ "not checked", "checked" ],
                defaultValue: "not checked",
                htmlAttribute: "checked"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            }
        },
        delegate: 'parent',
        template: function (node) {
            //var prop, code = $('<div data-role="header"><h1></h1></div>');
            var prop, label, code = $('<input type="radio"><label></label>');

            // always include id property on input
            code.filter('input').attr("id", node.getProperty("id"));

            // don't write value if it's using the default
            prop = node.getProperty("value");
            if (prop !== node.getPropertyDefault("value")) {
                code.filter('input').attr("value", prop);
            }

            // don't write checked if it's using the default
            prop = node.getProperty("checked");
            if (prop !== node.getPropertyDefault("checked")) {
                code.filter('input').attr("checked", prop);
            }

            // don't write data-theme if it's using the default
            prop = node.getProperty("theme");
            if (prop !== node.getPropertyDefault("theme")) {
                code.filter('input').attr("data-theme", prop);
            }

            // generate a "name" property for first child of ControlGroup
            if (!node.getParent().getChildrenCount()) {
                code.filter('input').attr("name", node.getProperty("id"));
            } else {
                code.filter('input').attr("name",
                          node.getParent().getChildren()[0].getProperty("id"));
            }

            // apply props to associated label
            label = code.next();

            // always add "for" attribute to label
            label.attr('for', node.getProperty("id"));

            // always include label property as inner text
            label.text(node.getProperty("label"));

            return code;
        },
    },

    /**
     * Represents a Checkbox Group object.
     */
    CheckboxGroup: {
        parent: "ButtonGroup",
        dragHeader: true,
        newGroup: true,
        displayLabel: "Checkbox Group",
        paletteImageName: "jqm_checkbox_group.svg",
        properties: {
            // FIXME: Put fieldcontain back in here, but will require
            //        support for selector on HTML attribute for data-type

            // FIXME: Before the legend was not written if with-legend was
            //        "no" -- instead, we could just check for empty legend
            //        in a template function, like I did in Slider in this
            //        commit. But it seems to work fine with a blank
            //        legend, so maybe it makes sense to always write to
            //        guide the user as they edit the HTML.
            legend: {
               type: "string",
               defaultValue: ""
            },
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: [ "Checkbox" ]
            }
        ],
        template: '<fieldset data-role="controlgroup"><legend>%LEGEND%</legend></fieldset>',
        init: function (node) {
            // initial state is three checkboxes
            var i;
            for (i = 0; i < 3; i++) {
                node.addChild(new ADMNode("Checkbox"));
            }
        },
    },

    /**
     * Represents an checkbox element.
     */
    Checkbox: {
        parent: "Base",
        paletteImageName: "jqm_checkbox.svg",
        editable: {
            selector: "span > .ui-btn-text",
            propertyName: "label"
        },
        properties: {
            id: {
                type: "string",
                autoGenerate: "checkbox",
                htmlAttribute: "id"
            },
            label: {
                type: "string",
                defaultValue: "Checkbox",
            },
            value: {
                type: "string",
                defaultValue: "",
                htmlAttribute: "value"
            },
            checked: {
                type: "string",
                options: [ "not checked", "checked" ],
                defaultValue: "not checked",
                htmlAttribute: "checked"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            }
        },
        template: '<input type="checkbox"><label for="%ID%">%LABEL%</label>',
        delegate: 'parent'
    },

    /**
     * Represents a unordered list element.
     */
    List: {
        parent: "Base",
        paletteImageName: "jqm_list.svg",
        dragHeader: true,
        newGroup: true,
        properties: {
            inset: {
                type: "boolean",
                defaultValue: "true",
                htmlAttribute: "data-inset",
                // because data-inset="false" is the real default, do this:
                forceAttribute: true
                // FIXME: would be better to distinguish from the default that
                //        occurs if you leave it off, vs. the default we think
                //        the user is most likely to want
            },
            filter: {
                type: "boolean",
                defaultValue: "false",
                htmlAttribute: "data-filter"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            },
            divider: {
                displayName: "divider theme",
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-divider-theme"
            }
        },
        template: '<ul data-role="listview">',
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: [ "ListItem", "ListDivider", "ListButton" ]
            }
        ],
    },

    /**
     * Represents an ordered list element.
     */
    OrderedList: {
        parent: "Base",
        dragHeader: true,
        displayLabel: "Ordered List",
        paletteImageName: "jqm_ordered_list.svg",
        properties: {
            inset: {
                type: "boolean",
                defaultValue: "true",
                htmlAttribute: "data-inset",
                // because data-inset="false" is the real default, do this:
                forceAttribute: true
                // FIXME: would be better to distinguish from the default that
                //        occurs if you leave it off, vs. the default we think
                //        the user is most likely to want
            },
            filter: {
                type: "boolean",
                defaultValue: "false",
                htmlAttribute: "data-filter"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            },
            divider: {
                displayName: "divider theme",
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-divider-theme"
            }
        },
        template: '<ol data-role="listview">',
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: [ "ListItem", "ListDivider", "ListButton" ]
            }
        ],
    },

    /**
     * Represents a list item element.
     */
    ListItem: {
        parent: "Base",
        displayLabel: "List Item",
        paletteImageName: "jqm_list_item.svg",
        allowIn: [ "List", "OrderedList" ],
        editable: {
            selector: "",
            propertyName: "text"
        },
        properties: {
            text: {
                type: "string",
                defaultValue: "List Item",
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            }
        },
        template: '<li>%TEXT%</li>'
    },

    /**
     * Represents a list divider element.
     */
    ListDivider: {
        parent: "Base",
        displayLabel: "List Divider",
        paletteImageName: "jqm_list_divider.svg",
        allowIn: [ "List", "OrderedList" ],
        editable: {
            selector: "",
            propertyName: "text"
        },
        properties: {
            text: {
                type: "string",
                defaultValue: "List Divider"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            }
        },
        template: '<li data-role="list-divider">%TEXT%</li>'
    },

    /**
     * Represents a button. A "text" string property holds the button text.
     */
    ListButton: {
        parent: "Base",
        displayLabel: "List Button",
        paletteImageName: "jqm_list_button.svg",
        allowIn: [ "List", "OrderedList" ],
        editable: {
            selector: "a",
            propertyName: "text"
        },
        properties: {
            text: {
                type: "string",
                defaultValue: "Button"
            },
            target: {
                type: "string",
                defaultValue: "",
                htmlAttribute: "href",
                htmlSelector: "a"
            },
            icon: {
                type: "string",
                options: [ "none", "alert", "arrow-d", "arrow-l", "arrow-r",
                           "arrow-u", "back", "check", "delete", "forward",
                           "gear", "grid", "home", "info", "minus", "plus",
                           "refresh", "search", "star" ],
                defaultValue: "none",
                htmlAttribute: "data-icon"
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            }
        },
        template: '<li><a>%TEXT%</a></li>'
    },

    /**
     * Represents a grid element.
     */
    Grid: {
        parent: "Base",
        dragHeader: true,
        paletteImageName: "jqm_grid.svg",
        newGroup: true,
        properties: {
            rows: {
                type: "integer",
                defaultValue: 1,
                setPropertyHook: function (node, value, transactionData) {
                    var rows, columns, i, block, map, children, blocks, count,
                        blockIndex, root;
                    rows = node.getProperty("rows");
                    columns = node.getProperty("columns");

                    // FIXME: really this should be enforced in the property
                    //        pane, or elsewhere; this won't really work
                    if (value < 1) {
                        value = 1;
                    }

                    root = node.getDesign();
                    root.suppressEvents(true);

                    // add rows if necessary
                    if (rows < value) {
                        if (transactionData) {
                            // use the array of blocks stored in transaction
                            blocks = transactionData;
                        }
                        else {
                            // create a new array of blocks
                            map = [ "a", "b", "c", "d", "e" ];
                            blocks = [];
                            count = rows;
                            while (count < value) {
                                for (i=0; i<columns; i++) {
                                    block = new ADMNode("Block");
                                    block.setProperty("subtype", map[i]);
                                    blocks.push(block);
                                }
                                count++;
                            }
                        }

                        // NOTE: be sure not to modify transactionData, so don't
                        //       modify blocks, which may point to it

                        // add blocks from this array to the new rows
                        blockIndex = 0;
                        while (rows < value) {
                            for (i=0; i<columns; i++) {
                                node.addChild(blocks[blockIndex++]);
                            }
                            rows++;
                        }
                    }

                    // remove rows if necessary
                    if (rows > value) {
                        count = (rows - value) * columns;
                        children = node.getChildren();
                        blocks = children.slice(children.length - count);
                        for (i=0; i<count; i++) {
                            node.removeChild(children.pop());
                        }
                        root.suppressEvents(false);
                        return blocks;
                    }
                    root.suppressEvents(false);
                }
            },
            columns: {
                type: "integer",
                options: [ 2, 3, 4, 5 ],
                defaultValue: 2,
                setPropertyHook: function (node, value, transactionData) {
                    var rows, columns, i, block, map, children, blocks, count,
                        index, blockIndex, root;
                    rows = node.getProperty("rows");
                    columns = node.getProperty("columns");

                    // we should be able to trust that columns is valid (2-5)
                    if (columns < 2 || columns > 5) {
                        throw new Error("invalid value found for grid columns");
                    }

                    root = node.getDesign();
                    root.suppressEvents(true);

                    // add columns if necessary
                    if (columns < value) {
                        if (transactionData) {
                            // use the array of blocks stored in transaction
                            blocks = transactionData;
                        }
                        else {
                            // create a new array of blocks
                            map = [ "", "", "c", "d", "e" ];
                            blocks = [];
                            count = columns;

                            while (count < value) {
                                for (i=0; i<rows; i++) {
                                    block = new ADMNode("Block");
                                    block.setProperty("subtype", map[count]);
                                    blocks.push(block);
                                }
                                count++;
                            }
                        }

                        // NOTE: be sure not to modify transactionData, so don't
                        //       modify blocks, which may point to it

                        // add blocks from this array to the new columns
                        blockIndex = 0;
                        while (columns < value) {
                            index = columns;
                            for (i=0; i<rows; i++) {
                                block = blocks[blockIndex++];
                                node.insertChildInZone(block, "default", index);
                                index += columns + 1;
                            }
                            columns++;
                        }
                    }

                    // remove columns if necessary
                    if (columns > value) {
                        blocks = [];
                        children = node.getChildren();
                        count = children.length;
                        while (value < columns) {
                            for (i = value; i < count; i += columns) {
                                blocks.push(children[i])
                                node.removeChild(children[i]);
                            }
                            value++;
                        }
                        root.suppressEvents(false);
                        return blocks;
                    }
                    root.suppressEvents(false);
                }
            }
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: "Block"
            }
        ],
        template: function (node) {
            var prop, classname, code = $('<div>');
            code = BWidgetRegistry.Base.applyProperties(node, code);

            // determine class attribute
            classname = "ui-grid-";
            prop = node.getProperty("columns");
            switch (prop) {
            case 5:  classname += "d"; break;
            case 4:  classname += "c"; break;
            case 3:  classname += "b"; break;
            default: classname += "a"; break;
            }
            code.attr("class", classname);

            return code;
        },
        init: function (node) {
            // initial state is one row with two columns, i.e. two blocks
            var block = new ADMNode("Block");
            node.addChild(block);

            block = new ADMNode("Block");
            block.setProperty("subtype", "b");
            node.addChild(block);
        }
    },

    /**
     * Represents a grid block element.
     */
    Block: {
        parent: "Base",
        showInPalette: false,
        selectable: false,
        outlineLabel: function (node) {
            var columns, row, col, children, map;

            if (node.getChildren().length == 0) {
                return "";
            }

            columns = node.getParent().getProperty("columns");
            row = Math.floor(node.getZoneIndex() / columns);

            map = { a: 1, b: 2, c: 3, d: 4, e: 5 };
            col = map[node.getProperty("subtype")];
            return "Row " + (row + 1) + ", Column " + col;
        },
        allowIn: "Grid",
        properties: {
            subtype: {
                type: "string",
                options: [ "a", "b", "c", "d", "e" ],
                defaultValue: "a",
            },
        },
        template: '<div class="ui-block-%SUBTYPE%"></div>',
        zones: [
            {
                name: "default",
                cardinality: "N"
            }
        ],
    },

    /**
     * Represents a collapsible element.
     */
    Collapsible: {
        parent: "Base",
        paletteImageName: "jqm_collapsible.svg",
        template: '<div data-role="collapsible"><h1>%HEADING%</h1></div>',
        newGroup: true,
        editable: {
            selector: "span.ui-btn-text",
            propertyName: "heading"
        },
        properties: {
            // NOTE: Removed "size" (h1 - h6) for the same reason we don't
            //       provide that option in header/footer currently. jQM
            //       renders them all the same, the purpose is only for the
            //       developer to distinguish between different levels of
            //       hierarchy for their own purposes. For now, I think it
            //       just makes sense to have them manually change them if
            //       they care, it's rather advanced and not something most
            //       of our users would care about.
            heading: {
                type: "string",
                defaultValue: "Collapsible Area",
            },
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            },
            content_theme: {
                displayName: "content theme",
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-content-theme"
            }
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
            }
        ],
        delegate: function (domNode, admNode) {
            var toggleCollapse = function (e){
                var selected = (e.node === admNode || e.node && admNode.findNodeByUid(e.node.getUid()))? true: false;
                domNode.trigger(selected ? 'expand' : 'collapse');
            },
            e = {};

            e.node = ADM.getDesignRoot().findNodeByUid(ADM.getSelected());
            toggleCollapse(e);
            ADM.bind("selectionChanged", toggleCollapse);
            return domNode;
        },
    },

    /**
     * Represents a set of collapsible elements.
     */
    Accordion: {
        parent: "Base",
        dragHeader: true,
        paletteImageName: "jqm_accordian.svg",
        template: '<div data-role="collapsible-set"></div>',
        properties: {
            theme: {
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-theme"
            },
            content_theme: {
                displayName: "content theme",
                type: "string",
                options: [ "default", "a", "b", "c", "d", "e" ],
                defaultValue: "default",
                htmlAttribute: "data-content-theme"
            }
        },
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: "Collapsible"
            }
        ],
    },

    DateTimePicker: {
        parent: "Base",
        paletteImageName: "tizen_date_picker.svg",
        template: '<input type="date" />',
        newGroup: true,
        newAccordion: true,
        delegate: 'next'
    },

    CalendarPicker: {
        parent: "Base",
        paletteImageName: "tizen_calendar_picker.svg",
        template: '<a data-role="calendarpicker" data-icon="grid" data-iconpos="notext" data-inline="true"></a>',

    },

    ColorPicker: {
        parent: "Base",
        paletteImageName: "tizen_color_picker.svg",
        template: '<div data-role="colorpicker" />',
        newGroup: true,
        properties: {
            data_color: {
                type: "string",
                defaultValue: "#ff00ff",
            },
        }
    },

    ColorPickerButton: {
        parent: "Base",
        paletteImageName: "tizen_color_picker_button.svg",
        template: '<div data-role="colorpickerbutton" />',
        properties: {
            data_color: {
                type: "string",
                defaultValue: "#1a8039",
            },
        },
        delegate: 'next'
    },

    ColorPalette: {
        parent: "Base",
        paletteImageName: "tizen_color_palette.svg",
        template: '<div data-role="colorpalette" />',
        properties: {
            data_color: {
                type: "string",
                defaultValue: "#1a8039",
            },
            show_preview: {
                type: "boolean",
                defaultValue: "false",
                htmlAttribute: "data-show-preview"
            }
        },
    },


    ColorTitle: {
        parent: "Base",
        paletteImageName: "tizen_color_title.svg",
        template: '<div data-role="colortitle" />',
        properties: {
            data_color: {
                type: "string",
                defaultValue: "#1a8039",
            },
        },
    },

    HsvPicker: {
        parent: "Base",
        paletteImageName: "tizen_hsv_color_picker.svg",
        template: '<div data-role="hsvpicker" />',
        properties: {
            data_color: {
                type: "string",
                defaultValue: "#1a8039",
            },
        },
    },

    ProgressBar: {
        parent: "Base",
        paletteImageName: "tizen_progress_bar.svg",
        newGroup: true,
        template: '<div data-role="processingbar" />',
    },

    Switch: {
        parent: "Base",
        paletteImageName: "tizen_vertical_toggle_switch.svg",
        template: '<div data-role="toggleswitch" />',
        delegate: 'next'
    },

    OptionHeader: {
        parent: "Base",
        paletteImageName: "tizen_option_header.svg",
        template: '<div data-role="optionheader" />',
        zones: [
            {
                name: "default",
                cardinality: "N",
                allow: "Grid"
            }
        ],
    },

};

/**
 * API to access aspects of the static widget definitions
 *
 * @class
 */
var BWidget = {
    init: function () {
        // effects: add the type and displayLabel properties to widget
        //          registry objects
        var type;
        for (type in BWidgetRegistry) {
            if (BWidgetRegistry.hasOwnProperty(type)) {
                BWidgetRegistry[type].type = type;

                if (BWidgetRegistry[type].displayLabel === undefined) {
                    // TODO: i18n: localize displayLabel based on type
                    BWidgetRegistry[type].displayLabel = type;
                }
                if (type === "DateTimePicker") {
                    BWidgetRegistry[type].displayLabel = "Date Time Picker";
                }
                if (type === "ColorPicker") {
                    BWidgetRegistry[type].displayLabel = "Color Picker";
                }
                if (type === "ColorPickerButton") {
                    BWidgetRegistry[type].displayLabel = "Color Picker Button";
                }
                if (type === "ColorPalette") {
                    BWidgetRegistry[type].displayLabel = "Color Palette";
                }
                if (type === "ColorTitle") {
                    BWidgetRegistry[type].displayLabel = "Color Title";
                }
                if (type === "HsvPicker") {
                    BWidgetRegistry[type].displayLabel = "HSV Picker";
                }
                if (type === "ProgressBar") {
                    BWidgetRegistry[type].displayLabel = "Progress Bar";
                }
                if (type === "CalendarPicker") {
                    BWidgetRegistry[type].displayLabel = "Calendar Picker";
                }
                if (type === "OptionHeader") {
                    BWidgetRegistry[type].displayLabel = "Option Header";
                }
            }
        }
    },

    /**
     * Checks to see whether the given widget type exists.
     *
     * @return {Boolean} True if the widget type exists.
     */
    typeExists: function (widgetType) {
        if (typeof BWidgetRegistry[widgetType] === "object") {
            return true;
        }
        return false;
    },

    /**
     * Gets an array of the widget type strings for widgets defined in the
     * registry that should be shown in the palette.
     *
     * @return {Array[String]} Array of widget type strings.
     */
    getPaletteWidgetTypes: function () {
        var types = [], type;
        for (type in BWidgetRegistry) {
            if (BWidgetRegistry.hasOwnProperty(type)) {
                if (BWidgetRegistry[type].showInPalette !== false) {
                    types.push(type);
                }
            }
        }
        return types;
    },

    /**
     * Gets an array of the widget objects for widgets defined in the registry
     * that should be shown in the palette.
     *
     * @return {Array[String]} Array of widget type strings.
     * @deprecated This function changed, now use getPaletteWidgetTypes; if
     *             you think you actually need this one, tell Geoff why.
     */
    getPaletteWidgets: function () {
        var widgets = [], type;
        for (type in BWidgetRegistry) {
            if (BWidgetRegistry.hasOwnProperty(type)) {
                if (BWidgetRegistry[type].showInPalette !== false) {
                    widgets.push(BWidgetRegistry[type]);
                }
            }
        }
        return widgets;
    },

    /**
     * Tests whether this widget type should be shown in the palette or
     * otherwise exposed to the user (e.g. in the outline view).
     *
     * @param {String} widgetType The type of the widget.
     * @return {Boolean} true if this widget is to be shown in the palette,
     *                   false if not or it is undefined.
     */
    isPaletteWidget: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget === "object" && widget.showInPalette !== false) {
            return true;
        }
        return false;
    },

    /**
     * Tests whether this widget type should be shown with a drag header bar.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Boolean} true if this widget is to be shown in the palette,
     *                   false if not or it is undefined.
     */
    isHeaderVisible: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget === "object" && widget.dragHeader !== true) {
            return false;
        }
        return true;
    },

    /**
     * Gets the palette image name for the given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {String} Palette image name.
     */
    getPaletteImageName: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget === "object") {
            return widget.paletteImageName;
        }
        return "missing.svg";
    },

    /**
     * Gets the display label for the given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {String} Display label.
     */
    getDisplayLabel: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget === "object") {
            return widget.displayLabel;
        }
        return "";
    },

    /**
     * Gets the icon id for the given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {String} Icon id.
     */
    getIcon: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        // TODO: remove the hard-coded icon defaults here and replace with
        //       real icons based on UX input/assets
        if (typeof widget === "object") {
            if (widget.icon === undefined) {
                return "";
            } else {
                return widget.icon;
            }
        }
        return "ui-icon-alert";
    },

    /**
     * Gets the initialization function for the given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Function(ADMNode)} The initialization function, or undefined if
     *                             there is none.
     */
    getInitializationFunction: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        return widget.init;
    },

    /**
     * Gets the available instance property types for a given widget type.
     * Follows parent chain to find inherited property types.
     * Note: Type strings still in definition, currently also using "integer"
     *
     * @param {String} widgetType The type of the widget.
     * @return {Object} Object with all of the widget's available properties,
     *                  whose values are Javascript type strings ("number",
     *                  "string", "boolean", "object", ...).
     * @throws {Error} If widgetType is invalid.
     */
    getPropertyTypes: function (widgetType) {
        var stack = [], props = {}, length, i, property, widget, currentWidget;
        widget = currentWidget = BWidgetRegistry[widgetType];

        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getPropertyTypes: " +
                            widgetType);
        }

        // build hierarchical stack so child properties will override parents
        while (currentWidget) {
            stack.unshift(currentWidget.properties);
            currentWidget = BWidgetRegistry[currentWidget.parent];
        }

        length = stack.length;
        for (i = 0; i < length; i++) {
            for (property in stack[i]) {
                if (stack[i].hasOwnProperty(property)) {
                    props[property] = stack[i][property].type;
                }
            }
        }
        return props;
    },

    /**
     * Gets the available instance property options for a given widget type.
     * Follows parent chain to find inherited properties.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Object} Object with all of the widget's available property
     *                  options, or undefined if the widget type is not
     *                  or no options defined.
     * @throws {Error} If widgetType is invalid.
     */
    getPropertyOptions: function (widgetType) {
        var stack = [], options = {}, length, i, property, widget, currentWidget;
        widget = currentWidget = BWidgetRegistry[widgetType];

        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getPropertyOptions: " +
                            widgetType);
        }

        // build hierarchical stack so child properties will override parents
        // although, really there should be no such conflicts
        while (currentWidget) {
            stack.unshift(currentWidget.properties);
            currentWidget = BWidgetRegistry[currentWidget.parent];
        }

        length = stack.length;
        for (i = 0; i < length; i++) {
            for (property in stack[i]) {
                if (stack[i].hasOwnProperty(property)) {
                    options[property] = stack[i][property].options;
                }
            }
        }
        return options;
    },

    /**
     * Gets the available instance property defaults for a given widget type.
     * Follows parent chain to find inherited properties.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Object} Object with all of the widget's available properties,
     *                  whose values are the default values.
     * @throws {Error} If widgetType is invalid.
     */
    getPropertyDefaults: function (widgetType) {
        var stack = [], props = {}, length, i, property, widget, currentWidget;
        widget = currentWidget = BWidgetRegistry[widgetType];

        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getPropertyDefaults: "+
                            widgetType);
        }

        // build hierarchical stack so child properties will override parents
        //   although, really there should be no such conflicts
        while (currentWidget) {
            stack.unshift(currentWidget.properties);
            currentWidget = BWidgetRegistry[currentWidget.parent];
        }

        length = stack.length;
        for (i = 0; i < length; i++) {
            for (property in stack[i]) {
                if (stack[i].hasOwnProperty(property)) {
                    props[property] = stack[i][property].defaultValue;
                }
            }
        }
        return props;
    },

    /**
     * Gets the property description schema a given instance property.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the requested property.
     * @return {Object} An object with a "type" string and "defaultValue" or
     *                  "autoGenerate" string.
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertySchema: function (widgetType, property) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getPropertySchema: " +
                            widgetType);
        }

        // build hierarchical stack so child properties will override parents
        while (widget) {
            if (widget.properties && widget.properties[property]) {
                return widget.properties[property];
            }
            widgetType = widget.parent;
            widget = BWidgetRegistry[widgetType];
        }

        // no such property found in hierarchy
        throw new Error("property not found in getPropertySchema: " + property);
    },

    /**
     * Gets the Javascript type string for a given instance property.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the requested property.
     * @return {String} The Javascript type string for the given property
     *                  ("number", "string", "boolean", "object", ...).
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertyType: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        if (schema) {
            return schema.type;
        }
        return schema;
    },

    /**
     * Gets the default value for a given instance property.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the requested property.
     * @return {AnyType} The default value for the given property, or
     *                   undefined if this property has no default (in which
     *                   case there should be an autoGenerate prefix set).
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertyDefault: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        if (schema) {
            return schema.defaultValue;
        }
        return schema;
    },

    /**
     * Gets the HTML attribute associated with this property.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the property.
     * @return {String} The name of an HTML attribute to set to this property
     *                  value in the template, or undefined if no HTML
     *                  attribute should be set.
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertyHTMLAttribute: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        if (schema) {
            return schema.htmlAttribute;
        }
        return schema;
    },

    /**
     * Gets the HTML selector that will find the DOM node this attribute
     * belongs to.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the property.
     * @return {String} An HTML selector that can be applied to the template
     *                  to find the DOM nodes that this attribute should be
     *                  applied to, or undefined if none.
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertyHTMLSelector: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        if (schema) {
            return schema.htmlSelector;
        }
        return schema;
    },

    /**
     * Gets whether or not the HTML attribute for this property should be
     * output even if it is the default value.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the property.
     * @return {Boolean} True if the HTML attribute for this property should
     *                   be set even if the proeprty is a default value.
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertyForceAttribute: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        if (schema) {
            return schema.forceAttribute;
        }
        return schema;
    },

    /**
     * Gets the auto-generate prefix for a given instance property. For now,
     * this only makes sense for string properties. The auto-generate string is
     * a prefix to which will be appended a unique serial number across this
     * widget type in the design.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the property.
     * @return {Boolean} Auto-generation string prefix, or undefined if there
     *                   is none or it is invalid.
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertyAutoGenerate: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        if (schema) {
            if (typeof schema.autoGenerate === "string") {
                return schema.autoGenerate;
            } else {
                return undefined;
            }
        }
        return schema;
    },


    /**
     * Gets the hook function provided for setting the given property, if it
     * exists. This function should be called just before a property is set, to
     * give the widget a chance to make any modifications to its children.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the property.
     * @return {Function(ADMNode, Any)} Override setter function for this
     *                                  property, or undefined if there
     *                                  is none.
     * @throws {Error} If widgetType is invalid, or property not found.
     */
    getPropertyHookFunction: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        if (schema) {
            if (typeof schema.setPropertyHook === "function") {
                return schema.setPropertyHook;
            } else {
                return undefined;
            }
        }
        return schema;
    },

    /**
     * Gets the visible in property view for a given instance property.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the requested property.
     * @return {Boolean} The visible in property view for the given property,
     *                   or true if this property has
     *                   no the attribute.
     */
    getPropertyVisibleInPropertyView: function (widgetType, property) {
        var schema = BWidget.getPropertySchema(widgetType, property);
        console.log(schema.visibleInPropertyView);

        if (schema && typeof(schema.visibleInPropertyView) == 'boolean') {
            return schema.visibleInPropertyView;
        } else {
            return true;
        }
    },

    /**
     * Determines if the given instance property exists for the given widget
     * type.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} property The name of the requested property.
     * @return {Boolean} True if the property exists, false otherwise.
     * @throws {Error} If widgetType is invalid.
     */
    propertyExists: function (widgetType, property) {
        var widget = BWidgetRegistry[widgetType], propertyType;
        if (typeof widget !== "object") {
            throw new Error("undefined widget type in propertyExists: " +
                            widgetType);
        }

        try {
            propertyType = BWidget.getPropertyType(widgetType, property);
        }
        catch(e) {
            // catch exception if property doesn't exist
            return false;
        }
        return true;
    },

    /**
     * Gets the template for a given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Various} The template string for this widget type, or an
     *                   object (FIXME: explain), or a function(ADMNode) that
     *                   provides a template, or undefined if the template does
     *                   not exist.
     * @throws {Error} If widgetType is invalid.
     */
    getTemplate: function (widgetType) {
        var widget, template;
        widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getTemplate: " +
                            widgetType);
        }

        template = widget.template;
        if (typeof template !== "string" && typeof template !== "object" &&
            typeof template !== "function") {
            return "";
        }
        return template;
    },

    /**
     * Gets the outline label function for a given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Function} The function(ADMNode) provided for this widget to
     *                    generate a label, or undefined if it does not exist.
     * @throws {Error} If widgetType is invalid.
     */
    getOutlineLabelFunction: function (widgetType) {
        var widget, func;
        widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getOutlineLabelFunction: "
                            + widgetType);
        }

        func = widget.outlineLabel;
        if (typeof func !== "function") {
            return undefined;
        }
        return func;
    },

    /**
     * Get redirect object for this type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Object} The redirect object containing 'zone' and 'type' fields,
     *                  or undefined if none.
     * @throws {Error} If widgetType is invalid.
     */
    getRedirect: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getRedirect: " +
                            widgetType);
        }
        return widget.redirect;
    },

    /**
     * Get the zones available for a given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @return {Array[String]} An array of the names of the available zones,
     *                         in the defined precedence order.
     * @throws {Error} If widgetType is invalid.
     */
    getZones: function (widgetType) {
        var zoneNames = [], widget, zones, length, i;
        widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getZones: " + widgetType);
        }

        zones = widget.zones;
        if (zones) {
            length = zones.length;
            for (i = 0; i < length; i++) {
                zoneNames.push(zones[i].name);
            }
        }
        return zoneNames;
    },

    /**
     * Get the cardinality for the given zone in the given widget type.
     *
     * @param {String} widgetType The type of the widget.
     * @param {String} zoneName The name of the zone.
     * @return {String} Returns the cardinality string: "1", "2", ... or "N".
     * @throws {Error} If widgetType is invalid or the zone is not found.
     */
    getZoneCardinality: function (widgetType, zoneName) {
        var widget, zones, length, i;
        widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("undefined widget type in getRedirect: " +
                            widgetType);
        }

        zones = widget.zones;
        if (zones && zones.length) {
            length = zones.length;
            for (i = 0; i < length; i++) {
                if (zones[i].name === zoneName) {
                    return zones[i].cardinality;
                }
            }
        }
        throw new Error("no such zone found in getZoneCardinality: " +
                        zoneName);
    },

    // helper function
    isTypeInList: function (type, list) {
        // requires: list can be an array, a string, or invalid
        //  returns: true, if type is the list string, or type is one of the
        //                 strings in list
        //           false, otherwise, or if list is invalid
        var i;
        if (list) {
            if (type === list) {
                return true;
            } else if (list.length > 0) {
                for (i = list.length - 1; i >= 0; i--) {
                    if (type === list[i]) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    /**
     * Checks whether a child type allows itself to be placed in a given parent.
     * Note: The parent may or may not allow the child.
     *
     * @param {String} parentType The type of the parent widget.
     * @param {String} childType The type of the child widget.
     * @return {Boolean} True if the relationship is allowed, false otherwise.
     * @throws {Error} If parentType or childType is invalid.
     */
    childAllowsParent: function (parentType, childType) {
        var parent, child, allowIn, denyIn;
        parent = BWidgetRegistry[parentType];
        child = BWidgetRegistry[childType];
        if ((typeof parent === "object") && (typeof child === "object")) {
            allowIn = child.allowIn;
            if (allowIn) {
                return BWidget.isTypeInList(parentType, allowIn);
            }
            denyIn = child.denyIn;
            if (denyIn) {
                return !BWidget.isTypeInList(parentType, denyIn);
            }
            return true;
        }
        throw new Error("invalid parent or child widget type in " +
                        "childAllowsParent");
    },

    /**
     * Checks whether a child type is allowed in a given parent zone.
     * Note: The parent may or may not allow the child.
     * Note: If the cardinality is "1" and there is already a child in the
     *       zone, it is "allowed" but still won't work.
     *
     * @param {String} parentType The type of the parent widget.
     * @param {String} zone The name of the parent zone.
     * @param {String} childType The type of the child widget.
     * @return {Boolean} True if the child type is allowed, false otherwise.
     * @throws {Error} If parentType or childType is invalid, or the zone is not
     *                 found.
     */
    zoneAllowsChild: function (parentType, zone, childType) {
        var parent, child, zones, i, allow, deny;
        parent = BWidgetRegistry[parentType];
        child = BWidgetRegistry[childType];
        if ((typeof parent !== "object") || (typeof child !== "object")) {
            throw new Error("parent or child type invalid in zoneAllowsChild");
        }

        zones = parent.zones;
        if (zones && zones.length > 0) {
            for (i = zones.length - 1; i >= 0; i--) {
                if (zones[i].name === zone) {
                    allow = zones[i].allow;
                    if (allow) {
                        return BWidget.isTypeInList(childType, allow);
                    }
                    deny = zones[i].deny;
                    if (deny) {
                        return !BWidget.isTypeInList(childType, deny);
                    }
                    return true;
                }
            }
        }
        throw new Error("no such zone found in zoneAllowsChild: " + zone);
    },

    /**
     * Checks whether a child type is allowed in some zone for the given
     * parent.
     * Note: The child may or may not allow the parent.
     *
     * @param {String} parentType The type of the parent widget.
     * @param {String} childType The type of the child widget.
     * @return {Boolean} True if the child type is allowed, false otherwise.
     * @throws {Error} If parentType or childType is invalid.
     */
    parentAllowsChild: function (parentType, childType) {
        var parent, zones, i;
        parent = BWidgetRegistry[parentType];
        if (typeof parent !== "object") {
            throw new Error("parent type invalid in parentAllowsChild");
        }

        zones = parent.zones;
        if (zones && zones.length > 0) {
            for (i = zones.length - 1; i >= 0; i--) {
                if (BWidget.zoneAllowsChild(parentType, zones[i].name,
                                            childType)) {
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * Finds zone names in the given parent type that will allow the given
     * child type.
     *
     * @param {String} parentType The type of the parent widget.
     * @param {String} childType The type of the child widget.
     * @return {Array[String]} Array of zone names that allow this child, in
     *                         precedence order, or an empty array if none.
     * @throws {Error} If parentType or childType is invalid.
     */
    zonesForChild: function (parentType, childType) {
        var array = [], parent, zones, i;
        if (!BWidget.childAllowsParent(parentType, childType)) {
            return [];
        }

        // parent must be valid of we would have failed previous call
        parent = BWidgetRegistry[parentType];
        zones = parent.zones;
        if (zones && zones.length > 0) {
            for (i = zones.length - 1; i >= 0; i--) {
                if (BWidget.zoneAllowsChild(parentType, zones[i].name,
                                            childType)) {
                    array.splice(0, 0, zones[i].name);
                }
            }
        }
        return array;
    },

    /**
     * Tests whether this BWidget is allowed to have it's textContent edited.
     *
     * @return {Object} if this BWidget is editable, null if not.
     * @throws {Error} If widgetType is invalid.
     */
    isEditable: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("widget type invalid in isEditable");
        }
        return widget.hasOwnProperty("editable") ? widget.editable : null;
    },

    /**
     * Tests whether this BWidget is allowed to be selected.
     *
     * @return {Boolean} True if this BWidget is selectable.
     * @throws {Error} If widgetType is invalid.
     */
    isSelectable: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("widget type invalid in isSelectable");
        }
        return widget.hasOwnProperty("selectable") ? widget.selectable : true;
    },

    /**
     * Tests whether this BWidget is allowed to be selected.
     *
     * @return {Boolean} True if this BWidget is selectable.
     * @throws {Error} If widgetType is invalid.
     */
    isMoveable: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("widget type invalid in isMoveable");
        }
        return widget.hasOwnProperty("moveable") ? widget.moveable : true;
    },

    /**
     * Tests whether this BWidget begins a new widget group.
     *
     * @return {Boolean} True if this BWidget is the first in a new group.
     * @throws {Error} If widgetType is invalid.
     */
    startsNewGroup: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("widget type invalid in startsNewGroup");
        }
        return widget.newGroup ? true : false;
    },

    /**
     * Tests whether this BWidget begins a new accordion.
     *
     * @return {Boolean} True if this BWidget is the first in a new group.
     * @throws {Error} If widgetType is invalid.
     */
    startsNewAccordion: function (widgetType) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("widget type invalid in startsNewAccordion");
        }
        return widget.newAccordion ? true : false;
    },

    /**
     * Gets the selection delegate for the given widget type.
     *
     * @return The attribute of the widget
     */
    getWidgetAttribute: function (widgetType, attribute) {
        var widget = BWidgetRegistry[widgetType];
        if (typeof widget !== "object") {
            throw new Error("widget type invalid in getWidgetAttribute");
        }
        return widget[attribute];
    }

};

// initialize the widget registry
BWidget.init();
