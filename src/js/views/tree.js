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

// Tree view widget


(function($, undefined) {

    $.widget('rib.treeView', {

        options: {
            model: null
        },

        enableKeyNavigation: function() {
            var o = this.options,
                e = this.element,
                widget = this;
            $(e).attr('tabindex', 1);
            $(e).keydown(widget._keydownHandler);
            $(e).focusout(function (e) {
                $(this).find(".focused").removeClass("focused");
            });
            $(e).focusin(function (e) {
                $(this).find(".ui-selected").addClass("focused");
            });

        },
        _keydownHandler: function (e) {
            var selected, focused, focusedIndex, items, focusing;
            selected = $(this).find(".ui-selected");
            focused = $(this).find(".focused");
            if (focused.length === 0) {
                selected.addClass("focused");
                focused = selected;
            }
            items = $(this).find("a:visible");
            focusedIndex = items.index(focused);
            if (focused === -1) {
                console.error("focused not in list items");
            }
            switch (e.which) {
                // for "up" key
                case 38:
                    focusing = (items.length + (focusedIndex - 1 )) % items.length;
                    break;
                // for "down" key
                case 40:
                    focusing = (focusedIndex + 1 ) % items.length;
                    break;
                // for "left" key
                case 37:
                // for "right" key
                case 39:
                    focused.prev("span.folder").trigger("click");
                    return false;
                // for "enter" key
                case 13:
                    focused.trigger("click");
                    return false;
                default:
                    break;
            }
            focused.removeClass("focused");
            $(items[focusing]).addClass("focused");
        },

        _setOption: function(key, value) {
            switch (key) {
                case 'model':
                    this.options.model = value;
                    this.refresh();
                    break;
                default:
                    break;
            }
        },

        _toTreeModel: function(model) {
            return model;
        },

        destroy: function() {
            // TODO: unbind any ADM event handlers
            $(this.element).find('.'+this.widgetName).remove();
        },

        refresh: function(event, widget) {
            var widget = widget || this;
            widget.element.addClass('treeView');
            if (widget.options.model) {
                widget._createTreeView(this.element.empty(),
                                       this._toTreeModel(this.options.model));
                widget.setSelected(widget._getSelected?widget._getSelected():null);
            }
        },

        _createTreeView: function (attachingNode, node, attachment) {
            var widget = this, container = attachingNode,
                parentDomNode = attachingNode.parent().parent(),
                attachment = attachment || 'appendTo';
            if (attachment === 'appendTo') {
                container = attachingNode.children('ul');
                if (container.length === 0) {
                    container = $('<ul/>').appendTo(attachingNode);
                    if (!attachingNode.hasClass('treeView')) {
                        // do not add this class to the top level list
                        container.addClass('widgetGroup');
                    }
                }
                parentDomNode = attachingNode;
            }
            $.each(node, function(i, v) {
                if ( $.isPlainObject(v)) {
                    //This is children definition
                    $.each(v, function(name , value) {
                        var folderNode;
                        if (name === "_hidden_node"||name === "_origin_node") {
                            return true;
                        }

                        parentDomNode.find('> span').addClass('folder')
                            .removeClass('singleItem').html('');

                        folderNode = $('<li/>')
                            [attachment](container)
                            .append($('<span/>')
                                .addClass('singleItem')
                                .html("&#x2022;")
                                .click(function(e) {
                                    $(this).toggleClass("close")
                                    .parent()
                                    .children("ul").toggle();
                                    e.stopPropagation();
                                }))
                            .append($('<a/>')
                                .append($('<span>').text(name)
                                                   .addClass('widgetType'))
                                .click(function (e) {
                                    e.stopPropagation();
                                    widget._nodeSelected(value, v._origin_node,
                                                         folderNode);
                                    return false;
                                })
                            )
                            .each(function () {
                                var origin_node = v._origin_node||value;
                                $(this).data('origin_node', origin_node);
                            });

                        if (typeof widget._render === "function") {
                                var newTopLevelNodes =
                                    widget._render(folderNode, v._origin_node);
                                // Store _origin_node in newly created top level
                                // nodes so that findDomNode can find it
                                newTopLevelNodes && newTopLevelNodes
                                    .data('origin_node', v._origin_node);
                        }
                        widget._createTreeView(folderNode, value);
                    });
                }
            });
        },

        _setSelected: function (domNode) {
            if (domNode[0]) {
                this.element.find('.ui-selected')
                    .removeClass('ui-selected')
                    .removeClass('ui-state-active');
                domNode.find('> a').addClass('ui-state-active')
                    .addClass('ui-selected')
                    [0].scrollIntoViewIfNeeded();
                domNode[0].scrollIntoViewIfNeeded();
            }
        },

        findDomNode: function (node) {
           return $('*', this.element).filter( function() {
               return $(this).data("origin_node") === node; });
        },

        findChildDomNodes: function (node) {
            var widget = this;
            return $('*', this.element).filter( function() {
                var origin_node = $(this).data("origin_node");
                    return origin_node &&
                        widget._getParent(origin_node) === node});
        },

        setSelected: function (node) {
           this._setSelected(this.findDomNode(node));
        },

        addNode: function (node) {
            var siblings, parentDomNode, index, widget = this,
                parentNode = widget._getParent(node);
            while (parentNode &&
                    (parentDomNode = widget.findDomNode(parentNode))
                    .length === 0)
                parentNode = widget._getParent(parentNode);
            siblings = widget._getChildTreeNodes(parentNode);
            if (parentDomNode.length === 0)
                parentDomNode = widget.element;
            for ( index = 0; index < siblings.length; index ++ ){
                if (siblings[index]._origin_node === node)
                    break;
            }
            if (siblings.length === 1)
                widget._createTreeView(parentDomNode, [siblings[index]]);
            else {
                if ( index === 0)
                    widget._createTreeView(widget.findDomNode
                            (siblings[index + 1]._origin_node).first(),
                            [siblings[index]], 'insertBefore');
                else
                    widget._createTreeView(widget.findDomNode
                            (siblings[index - 1]._origin_node).last(),
                            [siblings[index]], 'insertAfter');


            }
        },
        removeNode: function (node) {
            this.findDomNode(node).remove();
        },
        moveNode: function (node, oldParent) {
            this.removeNode(node, oldParent);
            this.addNode(node);
        },
    });
})(jQuery);
