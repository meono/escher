(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define('escher', factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.escher = factory();
    }
}(this, function () {
    //almond, and your modules will be inlined here

/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../build/almond", function(){});

/**
 * vkBeautify - javascript plugin to pretty-print or minify text in XML, JSON, CSS and SQL formats.
 *
 * Version - 0.99.00.beta
 * Copyright (c) 2012 Vadim Kiryukhin
 * vkiryukhin @ gmail.com
 * http://www.eslinstructor.net/vkbeautify/
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 *   Pretty print
 *
 *        vkbeautify.xml(text [,indent_pattern]);
 *        vkbeautify.json(text [,indent_pattern]);
 *        vkbeautify.css(text [,indent_pattern]);
 *        vkbeautify.sql(text [,indent_pattern]);
 *
 *        @text - String; text to beatufy;
 *        @indent_pattern - Integer | String;
 *                Integer:  number of white spaces;
 *                String:   character string to visualize indentation ( can also be a set of white spaces )
 *   Minify
 *
 *        vkbeautify.xmlmin(text [,preserve_comments]);
 *        vkbeautify.jsonmin(text);
 *        vkbeautify.cssmin(text [,preserve_comments]);
 *        vkbeautify.sqlmin(text);
 *
 *        @text - String; text to minify;
 *        @preserve_comments - Bool; [optional];
 *                Set this flag to true to prevent removing comments from @text ( minxml and mincss functions only. )
 *
 *   Examples:
 *        vkbeautify.xml(text); // pretty print XML
 *        vkbeautify.json(text, 4 ); // pretty print JSON
 *        vkbeautify.css(text, '. . . .'); // pretty print CSS
 *        vkbeautify.sql(text, '----'); // pretty print SQL
 *
 *        vkbeautify.xmlmin(text, true);// minify XML, preserve comments
 *        vkbeautify.jsonmin(text);// minify JSON
 *        vkbeautify.cssmin(text);// minify CSS, remove comments ( default )
 *        vkbeautify.sqlmin(text);// minify SQL
 *
 */

define('lib/vkbeautify',[],function() {

    function createShiftArr(step) {

        var space = '    ';

        if ( isNaN(parseInt(step)) ) {  // argument is string
            space = step;
        } else { // argument is integer
            switch(step) {
            case 1: space = ' '; break;
            case 2: space = '  '; break;
            case 3: space = '   '; break;
            case 4: space = '    '; break;
            case 5: space = '     '; break;
            case 6: space = '      '; break;
            case 7: space = '       '; break;
            case 8: space = '        '; break;
            case 9: space = '         '; break;
            case 10: space = '          '; break;
            case 11: space = '           '; break;
            case 12: space = '            '; break;
            }
        }

        var shift = ['\n']; // array of shifts
        for(ix=0;ix<100;ix++){
            shift.push(shift[ix]+space);
        }
        return shift;
    }

    function vkbeautify(){
        this.step = '    '; // 4 spaces
        this.shift = createShiftArr(this.step);
    };

    vkbeautify.prototype.xml = function(text,step) {

        var ar = text.replace(/>\s{0,}</g,"><")
                .replace(/</g,"~::~<")
                .replace(/\s*xmlns\:/g,"~::~xmlns:")
                .replace(/\s*xmlns\=/g,"~::~xmlns=")
                .split('~::~'),
            len = ar.length,
            inComment = false,
            deep = 0,
            str = '',
            ix = 0,
            shift = step ? createShiftArr(step) : this.shift;

        for(ix=0;ix<len;ix++) {
            // start comment or <![CDATA[...]]> or <!DOCTYPE //
            if(ar[ix].search(/<!/) > -1) {
                str += shift[deep]+ar[ix];
                inComment = true;
                // end comment  or <![CDATA[...]]> //
                if(ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1 || ar[ix].search(/!DOCTYPE/) > -1 ) {
                    inComment = false;
                }
            } else
                // end comment  or <![CDATA[...]]> //
                if(ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1) {
                    str += ar[ix];
                    inComment = false;
                } else
                    // <elm></elm> //
                    if( /^<\w/.exec(ar[ix-1]) && /^<\/\w/.exec(ar[ix]) &&
                        /^<[\w:\-\.\,]+/.exec(ar[ix-1]) == /^<\/[\w:\-\.\,]+/.exec(ar[ix])[0].replace('/','')) {
                        str += ar[ix];
                        if(!inComment) deep--;
                    } else
                        // <elm> //
                        if(ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) == -1 && ar[ix].search(/\/>/) == -1 ) {
                            str = !inComment ? str += shift[deep++]+ar[ix] : str += ar[ix];
                        } else
                            // <elm>...</elm> //
                            if(ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) > -1) {
                                str = !inComment ? str += shift[deep]+ar[ix] : str += ar[ix];
                            } else
                                // </elm> //
                                if(ar[ix].search(/<\//) > -1) {
                                    str = !inComment ? str += shift[--deep]+ar[ix] : str += ar[ix];
                                } else
                                    // <elm/> //
                                    if(ar[ix].search(/\/>/) > -1 ) {
                                        str = !inComment ? str += shift[deep]+ar[ix] : str += ar[ix];
                                    } else
                                        // <? xml ... ?> //
                                        if(ar[ix].search(/<\?/) > -1) {
                                            str += shift[deep]+ar[ix];
                                        } else
                                            // xmlns //
                                            if( ar[ix].search(/xmlns\:/) > -1  || ar[ix].search(/xmlns\=/) > -1) {
                                                str += shift[deep]+ar[ix];
                                            }

            else {
                str += ar[ix];
            }
        }

        return  (str[0] == '\n') ? str.slice(1) : str;
    }

    vkbeautify.prototype.json = function(text,step) {

        var step = step ? step : this.step;

        if (typeof JSON === 'undefined' ) return text;

        if ( typeof text === "string" ) return JSON.stringify(JSON.parse(text), null, step);
        if ( typeof text === "object" ) return JSON.stringify(text, null, step);

        return text; // text is not string nor object
    }

    vkbeautify.prototype.css = function(text, step) {

        var ar = text.replace(/\s{1,}/g,' ')
                .replace(/\{/g,"{~::~")
                .replace(/\}/g,"~::~}~::~")
                .replace(/\;/g,";~::~")
                .replace(/\/\*/g,"~::~/*")
                .replace(/\*\//g,"*/~::~")
                .replace(/~::~\s{0,}~::~/g,"~::~")
                .split('~::~'),
            len = ar.length,
            deep = 0,
            str = '',
            ix = 0,
            shift = step ? createShiftArr(step) : this.shift;

        for(ix=0;ix<len;ix++) {

            if( /\{/.exec(ar[ix]))  {
                str += shift[deep++]+ar[ix];
            } else
                if( /\}/.exec(ar[ix]))  {
                    str += shift[--deep]+ar[ix];
                } else
                    if( /\*\\/.exec(ar[ix]))  {
                        str += shift[deep]+ar[ix];
                    }
            else {
                str += shift[deep]+ar[ix];
            }
        }
        return str.replace(/^\n{1,}/,'');
    }

    //----------------------------------------------------------------------------

    function isSubquery(str, parenthesisLevel) {
        return  parenthesisLevel - (str.replace(/\(/g,'').length - str.replace(/\)/g,'').length )
    }

    function split_sql(str, tab) {

        return str.replace(/\s{1,}/g," ")

            .replace(/ AND /ig,"~::~"+tab+tab+"AND ")
            .replace(/ BETWEEN /ig,"~::~"+tab+"BETWEEN ")
            .replace(/ CASE /ig,"~::~"+tab+"CASE ")
            .replace(/ ELSE /ig,"~::~"+tab+"ELSE ")
            .replace(/ END /ig,"~::~"+tab+"END ")
            .replace(/ FROM /ig,"~::~FROM ")
            .replace(/ GROUP\s{1,}BY/ig,"~::~GROUP BY ")
            .replace(/ HAVING /ig,"~::~HAVING ")
        //.replace(/ SET /ig," SET~::~")
            .replace(/ IN /ig," IN ")

            .replace(/ JOIN /ig,"~::~JOIN ")
            .replace(/ CROSS~::~{1,}JOIN /ig,"~::~CROSS JOIN ")
            .replace(/ INNER~::~{1,}JOIN /ig,"~::~INNER JOIN ")
            .replace(/ LEFT~::~{1,}JOIN /ig,"~::~LEFT JOIN ")
            .replace(/ RIGHT~::~{1,}JOIN /ig,"~::~RIGHT JOIN ")

            .replace(/ ON /ig,"~::~"+tab+"ON ")
            .replace(/ OR /ig,"~::~"+tab+tab+"OR ")
            .replace(/ ORDER\s{1,}BY/ig,"~::~ORDER BY ")
            .replace(/ OVER /ig,"~::~"+tab+"OVER ")

            .replace(/\(\s{0,}SELECT /ig,"~::~(SELECT ")
            .replace(/\)\s{0,}SELECT /ig,")~::~SELECT ")

            .replace(/ THEN /ig," THEN~::~"+tab+"")
            .replace(/ UNION /ig,"~::~UNION~::~")
            .replace(/ USING /ig,"~::~USING ")
            .replace(/ WHEN /ig,"~::~"+tab+"WHEN ")
            .replace(/ WHERE /ig,"~::~WHERE ")
            .replace(/ WITH /ig,"~::~WITH ")

        //.replace(/\,\s{0,}\(/ig,",~::~( ")
        //.replace(/\,/ig,",~::~"+tab+tab+"")

            .replace(/ ALL /ig," ALL ")
            .replace(/ AS /ig," AS ")
            .replace(/ ASC /ig," ASC ")
            .replace(/ DESC /ig," DESC ")
            .replace(/ DISTINCT /ig," DISTINCT ")
            .replace(/ EXISTS /ig," EXISTS ")
            .replace(/ NOT /ig," NOT ")
            .replace(/ NULL /ig," NULL ")
            .replace(/ LIKE /ig," LIKE ")
            .replace(/\s{0,}SELECT /ig,"SELECT ")
            .replace(/\s{0,}UPDATE /ig,"UPDATE ")
            .replace(/ SET /ig," SET ")

            .replace(/~::~{1,}/g,"~::~")
            .split('~::~');
    }

    vkbeautify.prototype.sql = function(text,step) {

        var ar_by_quote = text.replace(/\s{1,}/g," ")
                .replace(/\'/ig,"~::~\'")
                .split('~::~'),
            len = ar_by_quote.length,
            ar = [],
            deep = 0,
            tab = this.step,//+this.step,
            inComment = true,
            inQuote = false,
            parenthesisLevel = 0,
            str = '',
            ix = 0,
            shift = step ? createShiftArr(step) : this.shift;;

        for(ix=0;ix<len;ix++) {
            if(ix%2) {
                ar = ar.concat(ar_by_quote[ix]);
            } else {
                ar = ar.concat(split_sql(ar_by_quote[ix], tab) );
            }
        }

        len = ar.length;
        for(ix=0;ix<len;ix++) {

            parenthesisLevel = isSubquery(ar[ix], parenthesisLevel);

            if( /\s{0,}\s{0,}SELECT\s{0,}/.exec(ar[ix]))  {
                ar[ix] = ar[ix].replace(/\,/g,",\n"+tab+tab+"")
            }

            if( /\s{0,}\s{0,}SET\s{0,}/.exec(ar[ix]))  {
                ar[ix] = ar[ix].replace(/\,/g,",\n"+tab+tab+"")
            }

            if( /\s{0,}\(\s{0,}SELECT\s{0,}/.exec(ar[ix]))  {
                deep++;
                str += shift[deep]+ar[ix];
            } else
                if( /\'/.exec(ar[ix]) )  {
                    if(parenthesisLevel<1 && deep) {
                        deep--;
                    }
                    str += ar[ix];
                }
            else  {
                str += shift[deep]+ar[ix];
                if(parenthesisLevel<1 && deep) {
                    deep--;
                }
            }
            var junk = 0;
        }

        str = str.replace(/^\n{1,}/,'').replace(/\n{1,}/g,"\n");
        return str;
    }


    vkbeautify.prototype.xmlmin = function(text, preserveComments) {

        var str = preserveComments ? text
                : text.replace(/\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>/g,"")
                .replace(/[ \r\n\t]{1,}xmlns/g, ' xmlns');
        return  str.replace(/>\s{0,}</g,"><");
    }

    vkbeautify.prototype.jsonmin = function(text) {

        if (typeof JSON === 'undefined' ) return text;

        return JSON.stringify(JSON.parse(text), null, 0);

    }

    vkbeautify.prototype.cssmin = function(text, preserveComments) {

        var str = preserveComments ? text
                : text.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g,"") ;

        return str.replace(/\s{1,}/g,' ')
            .replace(/\{\s{1,}/g,"{")
            .replace(/\}\s{1,}/g,"}")
            .replace(/\;\s{1,}/g,";")
            .replace(/\/\*\s{1,}/g,"/*")
            .replace(/\*\/\s{1,}/g,"*/");
    }

    vkbeautify.prototype.sqlmin = function(text) {
        return text.replace(/\s{1,}/g," ").replace(/\s{1,}\(/,"(").replace(/\s{1,}\)/,")");
    }

    return new vkbeautify();

});

define('utils',["lib/vkbeautify"], function(vkbeautify) {
    return { set_options: set_options,
             setup_svg: setup_svg,
	     remove_child_nodes: remove_child_nodes,
             load_css: load_css,
             load_files: load_files,
             load_the_file: load_the_file,
	     make_class: make_class,
	     setup_defs: setup_defs,
	     draw_an_array: draw_an_array,
	     draw_an_object: draw_an_object,
	     make_array: make_array,
	     compare_arrays: compare_arrays,
	     array_to_object: array_to_object,
	     clone: clone,
	     extend: extend,
	     unique_concat: unique_concat,
	     c_plus_c: c_plus_c,
	     c_minus_c: c_minus_c,
	     c_times_scalar: c_times_scalar,
	     download_json: download_json,
	     load_json: load_json,
	     export_svg: export_svg,
	     rotate_coords_recursive: rotate_coords_recursive,
	     rotate_coords: rotate_coords,
	     get_angle: get_angle,
	     to_degrees: to_degrees,
	     distance: distance,
	     check_undefined: check_undefined,
	     compartmentalize: compartmentalize,
	     decompartmentalize: decompartmentalize,
	     check_r: check_r };

    // definitions
    function set_options(options, defaults) {
        if (options===undefined) return defaults;
        var i = -1,
            out = defaults;
	for (var key in options) {
	    var val = options[key];
	    if (val===undefined) {
		val = null;
	    }
	    out[key] = val;
	}
        return out;
    }

    function setup_svg(selection, selection_is_svg, margins, fill_screen) {
        // sub selection places the graph in an existing svg environment
        var add_svg = function(f, s, m) {
            if (f) {
                d3.select("body").classed('fill-screen-body', true);
		s.classed('fill-screen-div', true);
            }
            var svg = s.append('svg')
		    .attr("class", "escher-svg")
                    .attr('xmlns', "http://www.w3.org/2000/svg");
	    return svg;
        };

        // run
        var out;
	// set the selection class
	selection.classed('escher-container', true);
	// make the svg
        if (selection_is_svg) {
            return selection;
        } else if (selection) {
            return add_svg(fill_screen, selection, margins);
        } else {
            throw Error('No selection');
        }
    }

    function remove_child_nodes(selection) {
	/** Removes all child nodes from a d3 selection

	 */
	var node =  selection.node();
	while (node.hasChildNodes()) {
	    node.removeChild(node.lastChild);
	}
    }

    function load_css(css_path, callback) {
        var css = "";
        if (css_path) {
            d3.text(css_path, function(error, text) {
                if (error) {
                    console.warn(error);
                }
                css = text;
                callback(css);
            });
        }
        return false;
    };
    function update() {
        return 'omg yes';
    };
    function load_the_file(t, file, callback, value) {
        // if the value is specified, don't even need to do the ajax query
        if (value) {
            if (file) console.warn('File ' + file + ' overridden by value.');
            callback.call(t, null, value, file);
            return;
        }
        if (!file) {
            callback.call(t, "No filename", null, file);
            return;
        }
        if (ends_with(file, 'json'))
	    d3.json(file, function(e, d) { callback(e, d, file); });
        else if (ends_with(file, 'css'))
	    d3.text(file, function(e, d) { callback(e, d, file); });
        else
	    callback.call(t, "Unrecognized file type", null, file);
        return;

        // definitions
        function ends_with(str, suffix) {
	    return str.indexOf(suffix, str.length - suffix.length) !== -1;
	}
    }
    function load_files(t, files_to_load, final_callback) {
        // load multiple files asynchronously
        // Takes a list of objects: { file: a_filename.json, callback: a_callback_fn }
        var i = -1, remaining = files_to_load.length, callbacks = {};
        while (++i < files_to_load.length) {
            var this_file = files_to_load[i].file;
            callbacks[this_file] = files_to_load[i].callback;
            load_the_file(t,
			  this_file,
                          function(e, d, file) {
                              callbacks[file].call(t, e, d);
                              if (!--remaining) final_callback.call(t);
                          },
                          files_to_load[i].value);
        }
    }
    // makeClass - By Hubert Kauker (MIT Licensed)
    // original by John Resig (MIT Licensed).
    // http://stackoverflow.com/questions/7892884/simple-class-instantiation
    function make_class(){
	var isInternal;
	var constructor = function(args){
            if ( this instanceof constructor ) {
		if ( typeof this.init == "function" ) {
                    this.init.apply( this, isInternal ? args : arguments );
		}
            } else {
		isInternal = true;
		var instance = new constructor( arguments );
		isInternal = false;
		return instance;
            }
	};
	return constructor;
    }

    function setup_defs(svg, style) {
        // add stylesheet
        svg.select("defs").remove();
        var defs = svg.append("defs");
        defs.append("style")
            .attr("type", "text/css")
            .text(style);
        return defs;
    }

    function draw_an_array(container_sel, parent_node_selector, children_selector,
			   array, create_function, update_function) {
	/** Run through the d3 data binding steps for an array.
	 */
	var sel = container_sel.select(parent_node_selector)
		.selectAll(children_selector)
		.data(array);
	// enter: generate and place reaction
	sel.enter().call(create_function);
	// update: update when necessary
	sel.call(update_function);
	// exit
	sel.exit().remove();
    }

    function draw_an_object(container_sel, parent_node_selector, children_selector,
			    object, id_key, create_function, update_function) {
	/** Run through the d3 data binding steps for an object.
	 */
	var sel = container_sel.select(parent_node_selector)
		.selectAll(children_selector)
		.data(make_array(object, id_key), function(d) { return d[id_key]; });
	// enter: generate and place reaction
	sel.enter().call(create_function);
	// update: update when necessary
	sel.call(update_function);
	// exit
	sel.exit().remove();
    }

    function make_array(obj, id_key) { // is this super slow?
        var array = [];
        for (var key in obj) {
            // copy object
            var it = clone(obj[key]);
            // add key as 'id'
            it[id_key] = key;
            // add object to array
            array.push(it);
        }
        return array;
    }

    function compare_arrays(a1, a2) {
	/** Compares two simple (not-nested) arrays.

	 */
	if (!a1 || !a2) return false;
	if (a1.length != a2.length) return false;
	for (var i = 0, l=a1.length; i < l; i++) {
            if (a1[i] != a2[i]) {
		// Warning - two different object instances will never be equal: {x:20} != {x:20}
		return false;
            }
	}
	return true;
    }

    function array_to_object(arr) {
	var obj = {};
	for (var i=0, l=arr.length; i<l; i++) { // 0
	    var a = arr[i];
	    for (var id in a) {
		if (id in obj) {
		    obj[id][i] = a[id];
		} else {
		    var n = [];
		    // fill leading spaces with null
		    for (var j=0; j<i; j++) {
			n[j] = null;
		    }
		    n[i] = a[id];
		    obj[id] = n;
		}
	    }
	    // fill trailing spaces with null
	    for (var id in obj) {
		for (var j=obj[id].length; j<=i; j++) {
		    obj[id][j] = null;
		}
	    }
	}
	return obj;
    }

    function clone(obj) {
	// Handles the array and object types, and null or undefined
	if (null == obj || "object" != typeof obj) return obj;
	// Handle Array
	if (obj instanceof Array) {
            var copy = [];
            for (var i = 0, len = obj.length; i < len; i++) {
		copy[i] = clone(obj[i]);
            }
            return copy;
	}
	// Handle Object
	if (obj instanceof Object) {
            var copy = {};
            for (var attr in obj) {
		if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
            }
            return copy;
	}
	throw new Error("Unable to copy obj! Its type isn't supported.");
    }

    function extend(obj1, obj2) {
	/** Extends obj1 with keys/values from obj2.

	 Performs the extension cautiously, and does not override attributes.

	 */
	for (var attrname in obj2) { 
	    if (!(attrname in obj1))
		obj1[attrname] = obj2[attrname];
	    else
		console.error('Attribute ' + attrname + ' already in object.');
	}
    }

    function unique_concat(arrays) {
	var new_array = [];
	arrays.forEach(function (a) {
	    a.forEach(function(x) {
		if (new_array.indexOf(x) < 0)
		    new_array.push(x);
	    });
	});
	return new_array;
    }

    function c_plus_c(coords1, coords2) {
	if (coords1 === null || coords2 === null || 
	    coords1 === undefined || coords2 === undefined)
	    return null;
	return { "x": coords1.x + coords2.x,
		 "y": coords1.y + coords2.y };
    }
    function c_minus_c(coords1, coords2) {
	if (coords1 === null || coords2 === null || 
	    coords1 === undefined || coords2 === undefined)
	    return null;
	return { "x": coords1.x - coords2.x,
		 "y": coords1.y - coords2.y };
    }

    function c_times_scalar(coords, scalar) {
	return { "x": coords.x * scalar,
		 "y": coords.y * scalar };
    }

    function download_json(json, name) {
        var a = document.createElement('a');
        a.download = name+'.json'; // file name
	var j = JSON.stringify(json);
        a.setAttribute("href-lang", "text/json");
        a.href = 'data:image/svg+xml;base64,' + utf8_to_b64(j); // create data uri
        // <a> constructed, simulate mouse click on it
        var ev = document.createEvent("MouseEvents");
        ev.initMouseEvent("click", true, false, self, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(ev);

        function utf8_to_b64(str) {
            return window.btoa(unescape(encodeURIComponent( str )));
        }
    }

    function load_json(f, callback, target) {
	// Check for the various File API support.
	if (!(window.File && window.FileReader && window.FileList && window.Blob))
	    callback.call(target, "The File APIs are not fully supported in this browser.", null);

	// The following is not a safe assumption.
	// if (!f.type.match("application/json"))
	//     callback.call(target, "Not a json file.", null);

	var reader = new window.FileReader();
	// Closure to capture the file information.
	reader.onload = function(event) {
	    var json = JSON.parse(event.target.result);
	    callback.call(target, null, json);
        };
	// Read in the image file as a data URL.
	reader.readAsText(f);
    }

    function export_svg(name, svg_sel, do_beautify) {
        var a = document.createElement('a'), xml, ev;
        a.download = name+'.svg'; // file name
	// convert node to xml string
        xml = (new XMLSerializer()).serializeToString(svg_sel.node()); 
        if (do_beautify) xml = vkbeautify.xml(xml);
        xml = '<?xml version="1.0" encoding="utf-8"?>\n \
            <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n \
        "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' + xml;
        a.setAttribute("href-lang", "image/svg+xml");
        a.href = 'data:image/svg+xml;base64,' + utf8_to_b64(xml); // create data uri
        // <a> constructed, simulate mouse click on it
        ev = document.createEvent("MouseEvents");
        ev.initMouseEvent("click", true, false, self, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(ev);
        
	// definitions
        function utf8_to_b64(str) {
            return window.btoa(unescape(encodeURIComponent( str )));
        }
    };

    function rotate_coords_recursive(coords_array, angle, center) {
	var rot = function(c) { return rotate_coords(c, angle, center); };
        return coords_array.map(rot);
    }

    function rotate_coords(c, angle, center) {
	/** Calculates displacement { x: dx, y: dy } based on rotating point c around 
	 center with angle.

	 */
        var dx = Math.cos(-angle) * (c.x - center.x) +
                Math.sin(-angle) * (c.y - center.y)
		+ center.x - c.x,
            dy = - Math.sin(-angle) * (c.x - center.x) +
                Math.cos(-angle) * (c.y - center.y)
		+ center.y - c.y;
        return { x: dx, y: dy };
    }

    function get_angle(coords) {
	/* Takes an array of 2 coordinate objects {"x": 1, "y": 1}
	 *
	 * Returns angle between 0 and 2PI.
	 */
	var denominator = coords[1].x - coords[0].x,
	    numerator = coords[1].y - coords[0].y;
	if (denominator==0 && numerator >= 0) return Math.PI/2;
	else if (denominator==0 && numerator < 0) return 3*Math.PI/2;
	else if (denominator >= 0 && numerator >= 0) return Math.atan(numerator/denominator);
	else if (denominator >= 0) return (Math.atan(numerator/denominator) + 2*Math.PI);
	else return (Math.atan(numerator/denominator) + Math.PI);
    }

    function to_degrees(radians) { return radians*180/Math.PI; }

    function distance(start, end) { return Math.sqrt(Math.pow(end.y-start.y, 2) + Math.pow(end.x-start.x, 2)); }

    function check_undefined(args, names) {
	/** Report an error if any of the arguments are undefined.

	 Call by passing in *arguments* from any function and an array of
	 argument names.

	 */
	names.map(function(name, i) {
	    if (args[i]===undefined) {
		console.error('Argument is undefined: '+String(names[i]));
	    }
	});
    }

    function compartmentalize(bigg_id, compartment_id) {
	return bigg_id + '_' + compartment_id;
    }


    // definitions
    function decompartmentalize(id) {
	/** Convert ids to bigg_id and compartment_id.
	 
	 */
	var out = no_compartment(id);
	if (out===null) out = [id, null];
	return out;

	// definitions
	function no_compartment(id) {
	    /** Returns an array of [bigg_id, compartment id].

	     Matches compartment ids with length 1 or 2.

	     Return null if no match is found.

	     */
	    var reg = /(.*)_([a-z0-9]{1,2})$/,
		result = reg.exec(id);
	    if (result===null) return null;
	    return result.slice(1,3);
	}
    }

    function check_r(o, spec, can_be_none) {
	if (typeof spec == "string") {
	    var the_type;
	    if (spec=='String') {
		the_type = function(x) { return typeof x == "string"; };
	    } else if (spec=="Float") {
		the_type = function(x) { return typeof x == "number"; };
	    } else if (spec=="Integer") {
		the_type = function(x) { return (typeof x == "number") &&
					 (parseFloat(x,10) == parseInt(x,10)); };
	    } else if (spec=="Boolean") {
		the_type = function(x) { return typeof x == "boolean"; };
	    } else if (spec!="*") {
		throw Error("Bad spec string: " + spec);
	    }
	    if (!the_type(o)) {
		throw Error('Bad type: '+String(o)+' should be '+spec);
	    }
	} else if (spec instanceof Array) {
	    o.forEach(function(x) {
		check_r(x, spec[0], can_be_none);
	    });
	} else { // dictionary/object
	    var key = Object.keys(spec)[0];
	    if (key == "*") {
		for (var k in o) {
		    if (o[k]===null && can_be_none.indexOf(k)!=-1) 
			continue;
		    check_r(o[k], spec[key], can_be_none);
		}
	    } else {
		for (var k in spec) {
		    if (!(k in o)) {
			throw Error('Missing key: %s' % k);
		    };
		    if (o[k]===null && can_be_none.indexOf(k)!=-1) 
			continue;
		    check_r(o[k], spec[k], can_be_none);
		}
	    }
	}
    }
});

/**
 * complete.ly 1.0.0
 * MIT Licensing
 * Copyright (c) 2013 Lorenzo Puccetti
 * 
 * This Software shall be used for doing good things, not bad things.
 * 
**/  
define('lib/complete.ly',[],function() {
return function(container, config) {
    config = config || {};
    config.fontSize =                       config.fontSize   || '16px';
    config.fontFamily =                     config.fontFamily || 'sans-serif';
    config.promptInnerHTML =                config.promptInnerHTML || ''; 
    config.color =                          config.color || '#333';
    config.hintColor =                      config.hintColor || '#aaa';
    config.backgroundColor =                config.backgroundColor || '#fff';
    config.dropDownBorderColor =            config.dropDownBorderColor || '#aaa';
    config.dropDownZIndex =                 config.dropDownZIndex || '100'; // to ensure we are in front of everybody
    config.dropDownOnHoverBackgroundColor = config.dropDownOnHoverBackgroundColor || '#ddd';
    
    var txtInput = document.createElement('input');
    txtInput.type ='text';
    txtInput.spellcheck = false; 
    txtInput.style.fontSize =        config.fontSize;
    txtInput.style.fontFamily =      config.fontFamily;
    txtInput.style.color =           config.color;
    txtInput.style.backgroundColor = config.backgroundColor;
    txtInput.style.width = '100%';
    txtInput.style.outline = '0';
    txtInput.style.border =  '0';
    txtInput.style.margin =  '0';
    txtInput.style.padding = '0';
    
    var txtHint = txtInput.cloneNode(); 
    txtHint.disabled='';        
    txtHint.style.position = 'absolute';
    txtHint.style.top =  '0';
    txtHint.style.left = '0';
    txtHint.style.borderColor = 'transparent';
    txtHint.style.boxShadow =   'none';
    txtHint.style.color = config.hintColor;
    
    txtInput.style.backgroundColor ='transparent';
    txtInput.style.verticalAlign = 'top';
    txtInput.style.position = 'relative';
    
    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.outline = '0';
    wrapper.style.border =  '0';
    wrapper.style.margin =  '0';
    wrapper.style.padding = '0';
    
    var prompt = document.createElement('div');
    prompt.style.position = 'absolute';
    prompt.style.outline = '0';
    prompt.style.margin =  '0';
    prompt.style.padding = '0';
    prompt.style.border =  '0';
    prompt.style.fontSize =   config.fontSize;
    prompt.style.fontFamily = config.fontFamily;
    prompt.style.color =           config.color;
    prompt.style.backgroundColor = config.backgroundColor;
    prompt.style.top = '0';
    prompt.style.left = '0';
    prompt.style.overflow = 'hidden';
    prompt.innerHTML = config.promptInnerHTML;
    prompt.style.background = 'transparent';
    if (document.body === undefined) {
        throw 'document.body is undefined. The library was wired up incorrectly.';
    }
    document.body.appendChild(prompt);            
    var w = prompt.getBoundingClientRect().right; // works out the width of the prompt.
    wrapper.appendChild(prompt);
    prompt.style.visibility = 'visible';
    prompt.style.left = '-'+w+'px';
    wrapper.style.marginLeft= w+'px';
    
    wrapper.appendChild(txtHint);
    wrapper.appendChild(txtInput);
    
    var dropDown = document.createElement('div');
    dropDown.style.position = 'absolute';
    dropDown.style.visibility = 'hidden';
    dropDown.style.outline = '0';
    dropDown.style.margin =  '0';
    dropDown.style.padding = '0';  
    dropDown.style.textAlign = 'left';
    dropDown.style.fontSize =   config.fontSize;      
    dropDown.style.fontFamily = config.fontFamily;
    dropDown.style.backgroundColor = config.backgroundColor;
    dropDown.style.zIndex = config.dropDownZIndex; 
    dropDown.style.cursor = 'default';
    dropDown.style.borderStyle = 'solid';
    dropDown.style.borderWidth = '1px';
    dropDown.style.borderColor = config.dropDownBorderColor;
    dropDown.style.overflowX= 'hidden';
    dropDown.style.whiteSpace = 'pre';
    dropDown.style.overflowY = 'scroll';  // note: this might be ugly when the scrollbar is not required. however in this way the width of the dropDown takes into account
    
    
    var createDropDownController = function(elem) {
        var rows = [];
        var ix = 0;
        var oldIndex = -1;
        
        var onMouseOver =  function() { this.style.outline = '1px solid #ddd'; }
        var onMouseOut =   function() { this.style.outline = '0'; }
        var onMouseDown =  function() { p.hide(); p.onmouseselection(this.__hint); }
        
        var p = {
            hide :  function() { elem.style.visibility = 'hidden'; }, 
            refresh : function(token, array) {
                elem.style.visibility = 'hidden';
                ix = 0;
                elem.innerHTML ='';
                var vph = (window.innerHeight || document.documentElement.clientHeight);
                var rect = elem.parentNode.getBoundingClientRect();
                var distanceToTop = rect.top - 6;                        // heuristic give 6px 
                var distanceToBottom = vph - rect.bottom -6;  // distance from the browser border.
                
                rows = [];
                for (var i=0;i<array.length;i++) {
                    if (array[i].indexOf(token)!==0) { continue; }
                    var divRow =document.createElement('div');
                    divRow.style.color = config.color;
                    divRow.onmouseover = onMouseOver; 
                    divRow.onmouseout =  onMouseOut;
                    divRow.onmousedown = onMouseDown; 
                    divRow.__hint =    array[i];
                    divRow.innerHTML = token+'<b>'+array[i].substring(token.length)+'</b>';
                    rows.push(divRow);
                    elem.appendChild(divRow);
                }
                if (rows.length===0) {
                    return; // nothing to show.
                }
                if (rows.length===1 && token === rows[0].__hint) {
                    return; // do not show the dropDown if it has only one element which matches what we have just displayed.
                }
                
                if (rows.length<2) return; 
                p.highlight(0);
                
                if (distanceToTop > distanceToBottom*3) {        // Heuristic (only when the distance to the to top is 4 times more than distance to the bottom
                    elem.style.maxHeight =  distanceToTop+'px';  // we display the dropDown on the top of the input text
                    elem.style.top ='';
                    elem.style.bottom ='100%';
                } else {
                    elem.style.top = '100%';  
                    elem.style.bottom = '';
                    elem.style.maxHeight =  distanceToBottom+'px';
                }
                elem.style.visibility = 'visible';
            },
            highlight : function(index) {
                if (oldIndex !=-1 && rows[oldIndex]) { 
                    rows[oldIndex].style.backgroundColor = config.backgroundColor;
                }
                rows[index].style.backgroundColor = config.dropDownOnHoverBackgroundColor; // <-- should be config
                oldIndex = index;
            },
            move : function(step) { // moves the selection either up or down (unless it's not possible) step is either +1 or -1.
                if (elem.style.visibility === 'hidden')             return ''; // nothing to move if there is no dropDown. (this happens if the user hits escape and then down or up)
                if (ix+step === -1 || ix+step === rows.length) return rows[ix].__hint; // NO CIRCULAR SCROLLING. 
                ix+=step; 
                p.highlight(ix);
                return rows[ix].__hint;//txtShadow.value = uRows[uIndex].__hint ;
            },
            onmouseselection : function() {} // it will be overwritten. 
        };
        return p;
    }
    
    var dropDownController = createDropDownController(dropDown);
    
    dropDownController.onmouseselection = function(text) {
        txtInput.value = txtHint.value = leftSide+text; 
        rs.onChange(txtInput.value); // <-- forcing it.
        registerOnTextChangeOldValue = txtInput.value; // <-- ensure that mouse down will not show the dropDown now.
        setTimeout(function() { txtInput.focus(); },0);  // <-- I need to do this for IE 
    }
    
    wrapper.appendChild(dropDown);
    container.appendChild(wrapper);
    
    var spacer; 
    var leftSide; // <-- it will contain the leftSide part of the textfield (the bit that was already autocompleted)
    
    
    function calculateWidthForText(text) {
        if (spacer === undefined) { // on first call only.
            spacer = document.createElement('span'); 
            spacer.style.visibility = 'hidden';
            spacer.style.position = 'fixed';
            spacer.style.outline = '0';
            spacer.style.margin =  '0';
            spacer.style.padding = '0';
            spacer.style.border =  '0';
            spacer.style.left = '0';
            spacer.style.whiteSpace = 'pre';
            spacer.style.fontSize =   config.fontSize;
            spacer.style.fontFamily = config.fontFamily;
            spacer.style.fontWeight = 'normal';
            document.body.appendChild(spacer);    
        }        
        
        // Used to encode an HTML string into a plain text.
        // taken from http://stackoverflow.com/questions/1219860/javascript-jquery-html-encoding
        spacer.innerHTML = String(text).replace(/&/g, '&amp;')
                                       .replace(/"/g, '&quot;')
                                       .replace(/'/g, '&#39;')
                                       .replace(/</g, '&lt;')
                                       .replace(/>/g, '&gt;');
        return spacer.getBoundingClientRect().right;
    }
    
    
    var rs = { 
        onArrowDown : function() {},               // defaults to no action.
        onArrowUp :   function() {},               // defaults to no action.
        onEnter :     function() {},               // defaults to no action.
        onTab :       function() {},               // defaults to no action.
        onChange:     function() { rs.repaint() }, // defaults to repainting.
        startFrom:    0,
        options:      [],
        wrapper : wrapper,      // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations)
        input :  txtInput,      // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations) 
        hint  :  txtHint,       // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations)
        dropDown :  dropDown,         // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations)
        prompt : prompt,
        setText : function(text) {
            txtHint.value = text;
            txtInput.value = text; 
        },
        getText : function() {
        	return txtInput.value; 
        },
        hideDropDown : function() {
        	dropDownController.hide();
        },
        repaint : function() {
            var text = txtInput.value;
            var startFrom =  rs.startFrom; 
            var options =    rs.options;
            var optionsLength = options.length; 
            
            // breaking text in leftSide and token.
            var token = text.substring(startFrom);
            leftSide =  text.substring(0,startFrom);
            
            // updating the hint. 
            txtHint.value ='';
            for (var i=0;i<optionsLength;i++) {
                var opt = options[i];
                if (opt.indexOf(token)===0) {         // <-- how about upperCase vs. lowercase
                    txtHint.value = leftSide +opt;
                    break;
                }
            }
            
            // moving the dropDown and refreshing it.
            dropDown.style.left = calculateWidthForText(leftSide)+'px';
            dropDownController.refresh(token, rs.options);
        }
    };
    
    var registerOnTextChangeOldValue;

    /**
     * Register a callback function to detect changes to the content of the input-type-text.
     * Those changes are typically followed by user's action: a key-stroke event but sometimes it might be a mouse click.
    **/
    var registerOnTextChange = function(txt, callback) {
        registerOnTextChangeOldValue = txt.value;
        var handler = function() {
            var value = txt.value;
            if (registerOnTextChangeOldValue !== value) {
                registerOnTextChangeOldValue = value;
                callback(value);
            }
        };

        //  
        // For user's actions, we listen to both input events and key up events
        // It appears that input events are not enough so we defensively listen to key up events too.
        // source: http://help.dottoro.com/ljhxklln.php
        //
        // The cost of listening to three sources should be negligible as the handler will invoke callback function
        // only if the text.value was effectively changed. 
        //  
        // 
        if (txt.addEventListener) {
            txt.addEventListener("input",  handler, false);
            txt.addEventListener('keyup',  handler, false);
            txt.addEventListener('change', handler, false);
        } else { // is this a fair assumption: that attachEvent will exist ?
            txt.attachEvent('oninput', handler); // IE<9
            txt.attachEvent('onkeyup', handler); // IE<9
            txt.attachEvent('onchange',handler); // IE<9
        }
    };
    
    
    registerOnTextChange(txtInput,function(text) { // note the function needs to be wrapped as API-users will define their onChange
        rs.onChange(text);
    });
    
    
    var keyDownHandler = function(e) {
        e = e || window.event;
        var keyCode = e.keyCode;
        
        if (keyCode == 33) { return; } // page up (do nothing)
        if (keyCode == 34) { return; } // page down (do nothing);
        
        if (keyCode == 27) { //escape
            dropDownController.hide();
            txtHint.value = txtInput.value; // ensure that no hint is left.
            txtInput.focus(); 
            return; 
        }
        
        if (keyCode == 39 || keyCode == 35 || keyCode == 9) { // right,  end, tab  (autocomplete triggered)
        	if (keyCode == 9) { // for tabs we need to ensure that we override the default behaviour: move to the next focusable HTML-element 
           	    e.preventDefault();
                e.stopPropagation();
                if (txtHint.value.length == 0) {
                	rs.onTab(); // tab was called with no action.
                	            // users might want to re-enable its default behaviour or handle the call somehow.
                }
            }
            if (txtHint.value.length > 0) { // if there is a hint
                dropDownController.hide();
                txtInput.value = txtHint.value;
                var hasTextChanged = registerOnTextChangeOldValue != txtInput.value
                registerOnTextChangeOldValue = txtInput.value; // <-- to avoid dropDown to appear again. 
                                                          // for example imagine the array contains the following words: bee, beef, beetroot
                                                          // user has hit enter to get 'bee' it would be prompted with the dropDown again (as beef and beetroot also match)
                if (hasTextChanged) {
                    rs.onChange(txtInput.value); // <-- forcing it.
                }
            }
            return; 
        }
        
        if (keyCode == 13) {       // enter  (autocomplete triggered)
            if (txtHint.value.length == 0) { // if there is a hint
                rs.onEnter();
            } else {
                var wasDropDownHidden = (dropDown.style.visibility == 'hidden');
                dropDownController.hide();
                
                if (wasDropDownHidden) {
                    txtHint.value = txtInput.value; // ensure that no hint is left.
                    txtInput.focus();
                    rs.onEnter();    
                    return; 
                }
                
                txtInput.value = txtHint.value;
                var hasTextChanged = registerOnTextChangeOldValue != txtInput.value
                registerOnTextChangeOldValue = txtInput.value; // <-- to avoid dropDown to appear again. 
                                                          // for example imagine the array contains the following words: bee, beef, beetroot
                                                          // user has hit enter to get 'bee' it would be prompted with the dropDown again (as beef and beetroot also match)
                if (hasTextChanged) {
                    rs.onChange(txtInput.value); // <-- forcing it.
                }
                
            }
            return; 
        }
        
        if (keyCode == 40) {     // down
            var m = dropDownController.move(+1);
            if (m == '') { rs.onArrowDown(); }
            txtHint.value = leftSide+m;
            return; 
        } 
            
        if (keyCode == 38 ) {    // up
            var m = dropDownController.move(-1);
            if (m == '') { rs.onArrowUp(); }
            txtHint.value = leftSide+m;
            e.preventDefault();
            e.stopPropagation();
            return; 
        }
            
        // it's important to reset the txtHint on key down.
        // think: user presses a letter (e.g. 'x') and never releases... you get (xxxxxxxxxxxxxxxxx)
        // and you would see still the hint
        txtHint.value =''; // resets the txtHint. (it might be updated onKeyUp)
        
    };
    
    if (txtInput.addEventListener) {
        txtInput.addEventListener("keydown",  keyDownHandler, false);
    } else { // is this a fair assumption: that attachEvent will exist ?
        txtInput.attachEvent('onkeydown', keyDownHandler); // IE<9
    }
    return rs;
}
});

define('data_styles',["utils"], function(utils) {
    return { import_and_check: import_and_check,
	     text_for_data: text_for_data,
	     float_for_data: float_for_data
	   };

    function import_and_check(data, styles, name) {
	if (data===null) return null;
	// make array
	if (!(data instanceof Array)) {
	    data = [data];
	}
	// check data
	var check = function() {
	    if (data===null)
		return null;
	    if (data.length==1)
		return null;
	    if (data.length==2 && styles.indexOf('Diff')!=-1)
		return null;
	    return console.warn('Bad data style: '+name);
	};
	check();
	data = utils.array_to_object(data);
	return data;
    }

    function float_for_data(d, styles, ignore_abs) {
	if (ignore_abs===undefined) ignore_abs = false;
	if (d===null) return null;
	var f = null;
	if (d.length==1) f = d[0];
	if (d.length==2 && styles.indexOf('Diff')!=-1) { // abs
	    if (d[0]===null || d[1]===null) return null;
	    else f = d[1] - d[0];
	}
	if (styles.indexOf('Abs')!=-1 && !ignore_abs) {
	    f = Math.abs(f);
	}
	return f;
    }

    function text_for_data(d, styles) {
	if (d===null)
	    return null_or_d(null);
	var f = float_for_data(d, styles, true);
	if (d.length==1) {
	    var format = d3.format('.4g');
	    return null_or_d(f, format);
	}
	if (d.length==2 && styles.indexOf('Diff')!=-1) {
	    var format = d3.format('.3g'),
		t = null_or_d(d[0], format);
	    t += ', ' + null_or_d(d[1], format);
	    t += ': ' + null_or_d(f, format);
	    return t;
	}
	return '';

	// definitions
	function null_or_d(d, format) {
	    return d===null ? '(nd)' : format(d);
	}
    }
});



define('draw',["utils", "data_styles"], function(utils, data_styles) {
    return { create_reaction: create_reaction,
	     update_reaction: update_reaction,
	     create_node: create_node,
	     update_node: update_node,
	     create_text_label: create_text_label,
	     update_text_label: update_text_label,
	     create_membrane: create_membrane,
	     update_membrane: update_membrane
	   };

    // definitions
    function turn_off_drag(sel) {
	sel.on('mousedown.drag', null);
	sel.on('touchstart.drag', null);
    }
    
    function create_membrane(enter_selection) {
	utils.check_undefined(arguments, ['enter_selection']);
	enter_selection.append('rect')
	    .attr('class', 'membrane');
    }

    function update_membrane(update_selection) {
	utils.check_undefined(arguments, ['enter_selection']);
        update_selection
            .attr("width", function(d){ return d.width; })
            .attr("height", function(d){ return d.height; })
            .attr("transform", function(d){return "translate("+d.x+","+d.y+")";})
            .style("stroke-width", function(d) { return 10; })
            .attr('rx', function(d){ return 20; })
            .attr('ry', function(d){ return 20; });
    }

    function create_reaction(enter_selection) {
	utils.check_undefined(arguments, ['enter_selection']);
        // attributes for new reaction group

        var t = enter_selection.append('g')
                .attr('id', function(d) { return 'r'+d.reaction_id; })
                .attr('class', 'reaction')
                .call(create_reaction_label);
        return;
    }

    function update_reaction(update_selection, scale, drawn_nodes, show_beziers,
			     defs,
			     default_reaction_color, has_reaction_data,
			     reaction_data_styles,
			     bezier_drag_behavior, label_drag_behavior) {
	utils.check_undefined(arguments,
			      ['update_selection', 'scale', 'drawn_nodes', 'show_beziers',
			       'defs',
			       'default_reaction_color', 'has_reaction_data',
			       'reaction_data_styles',
			       'bezier_drag_behavior', 'label_drag_behavior']);

        // update reaction label
        update_selection.select('.reaction-label')
            .call(function(sel) { return update_reaction_label(sel, has_reaction_data, 
							       reaction_data_styles,
							       label_drag_behavior); });

        // select segments
        var sel = update_selection
                .selectAll('.segment-group')
                .data(function(d) {
                    return utils.make_array(d.segments, 'segment_id');
                }, function(d) { return d.segment_id; });

        // new segments
        sel.enter().call(create_segment);

        // update segments
        sel.call(function(sel) { 
	    return update_segment(sel, scale, drawn_nodes, show_beziers, defs,
				  default_reaction_color,
				  has_reaction_data, reaction_data_styles,
				  bezier_drag_behavior);
	});

        // old segments
        sel.exit().remove();
    }

    function create_reaction_label(sel) {
	utils.check_undefined(arguments, ['sel']);
        /* Draw reaction label for selection.
	 */
        sel.append('text')
            .attr('class', 'reaction-label label')
	    .style('cursor', 'default');
    }

    function update_reaction_label(sel, has_reaction_data, 
				   reaction_data_styles,
				   label_drag_behavior) {
	utils.check_undefined(arguments, ['sel',
					  'has_reaction_data',
					  'reaction_data_styles',
					  'label_drag_behavior']);
	
	var decimal_format = d3.format('.4g');
	sel.text(function(d) { 
            var t = d.bigg_id;
	    if (has_reaction_data)
		t += ' ' + d.data_string;
            return t;
	}).attr('transform', function(d) {
            return 'translate('+d.label_x+','+d.label_y+')';
	}).style("font-size", function(d) {
	    return String(30)+"px";
        })
	    .call(turn_off_drag)
	    .call(label_drag_behavior);
    }

    function create_segment(enter_selection) {
	utils.check_undefined(arguments, ['enter_selection']);

        // create segments
        var g = enter_selection
                .append('g')
                .attr('class', 'segment-group')
                .attr('id', function(d) { return 's'+d.segment_id; });

        // create reaction arrow
        g.append('path')
            .attr('class', 'segment');

	g.append('g')
	    .attr('class', 'arrowheads');

	g.append('g')
	    .attr('class', 'beziers');
    }
    
    function update_segment(update_selection, scale, drawn_nodes, show_beziers, 
			    defs, default_reaction_color,
			    has_reaction_data, reaction_data_styles,
			    bezier_drag_behavior) {
	utils.check_undefined(arguments, ['update_selection', 'scale', 'drawn_nodes',
					  'show_beziers', 'defs',
					  'default_reaction_color',
					  'has_reaction_data',
					  'reaction_data_styles',
					  'bezier_drag_behavior']);

        // update segment attributes
	var get_disp = function(reversibility, coefficient) {
	    return (reversibility || coefficient > 0) ? 32 : 20;
	};
        // update arrows
        update_selection
            .selectAll('.segment')
            .datum(function() {
                return this.parentNode.__data__;
            })
            .attr('d', function(d) {
		if (d.from_node_id==null || d.to_node_id==null)
		    return null;
		var start = drawn_nodes[d.from_node_id],
		    end = drawn_nodes[d.to_node_id],
		    b1 = d.b1,
		    b2 = d.b2;
		// if metabolite, then displace the arrow
		if (start['node_type']=='metabolite' && b1!==null) {
		    var disp = get_disp(d.reversibility, d.from_node_coefficient);
		    var direction = (b1 === null) ? end : b1;
		    start = displaced_coords(disp, start, direction, 'start');
		}
		if (end['node_type']=='metabolite') {
		    var disp = get_disp(d.reversibility, d.to_node_coefficient);
		    var direction = (b2 === null) ? start : b2;
		    end = displaced_coords(disp, direction, end, 'end');
		}
		var curve = ('M'+start.x+','+start.y+' ');
		if (b1 !== null && b2 !== null) {
		    curve += ('C'+b1.x+','+b1.y+' '+
                              b2.x+','+b2.y+' ');
		}
		curve += (end.x+','+end.y);
		return curve;
            })
            .style('stroke', function(d) {
		if (has_reaction_data && reaction_data_styles.indexOf('Color')!==-1) {
		    var f = d.data;
		    return scale.reaction_color(f===null ? 0 : f);
		} else {
		    return default_reaction_color;
		}
	    })
	    .style('stroke-width', function(d) {
		if (has_reaction_data && reaction_data_styles.indexOf('Size')!==-1) {
		    var f = d.data;
		    return scale.reaction_size(f===null ? 0 : f);
		} else {
		    return scale.reaction_size(0);
		}
            });

	// new arrowheads
	var arrowheads = update_selection.select('.arrowheads')
	    .selectAll('.arrowhead')
	    .data(function (d) {
		var arrowheads = [],
		    reaction_id = this.parentNode.parentNode.parentNode.__data__.reaction_id,
		    segment_id = this.parentNode.parentNode.__data__.segment_id;		
		var start = drawn_nodes[d.from_node_id],
		    b1 = d.b1;
		if (start.node_type=='metabolite' && (d.reversibility || d.from_node_coefficient > 0)) {
		    var disp = get_disp(d.reversibility, d.from_node_coefficient),
			direction = (b1 === null) ? end : b1;
		    var rotation = utils.to_degrees(utils.get_angle([start, direction])) + 90;
		    start = displaced_coords(disp, start, direction, 'start');
		    arrowheads.push({ data: d.data,
				      x: start.x,
				      y: start.y,
				      rotation: rotation });
		}
		var end = drawn_nodes[d.to_node_id],
		    b2 = d.b2;
		if (end.node_type=='metabolite' && (d.reversibility || d.to_node_coefficient > 0)) {
		    var disp = get_disp(d.reversibility, d.to_node_coefficient),
			direction = (b2 === null) ? start : b2;
		    var rotation = utils.to_degrees(utils.get_angle([end, direction])) + 90;
		    end = displaced_coords(disp, direction, end, 'end');
		    arrowheads.push({ data: d.data,
				      x: end.x,
				      y: end.y,
				      rotation: rotation });
		}
		return arrowheads;
	    });
	arrowheads.enter().append('path')
	    .classed('arrowhead', true);
	// update bezier points
	arrowheads.attr("d", function(d) {
	    var markerWidth = 20, markerHeight = 13;
	    if (has_reaction_data && reaction_data_styles.indexOf('Size')!==-1) {
		var f = d.data;
		markerWidth += (scale.reaction_size(f) - scale.reaction_size(0));
	    }		    
	    return 'M'+[-markerWidth/2, 0]+' L'+[0, markerHeight]+' L'+[markerWidth/2, 0]+' Z';
	}).attr('transform', function(d) {
	    return 'translate('+d.x+','+d.y+')rotate('+d.rotation+')';
	}).attr('fill', function(d) {
	    var c;
	    if (has_reaction_data && reaction_data_styles.indexOf('Color')!==-1) {
		var f = d.data;
		c = scale.reaction_color(f===null ? 0 : f);
	    } else {
		c = default_reaction_color;
	    }
	    return c;
	});
	// remove
	arrowheads.exit().remove();

	// new bezier points
	var bez = update_selection.select('.beziers')
		.selectAll('.bezier')
		.data(function(d) {
		    var beziers = [],
			reaction_id = this.parentNode.parentNode.parentNode.__data__.reaction_id,
			segment_id = this.parentNode.parentNode.__data__.segment_id;
		    //TODO fix; this is a bit of a hack
		    if (d.b1!=null && d.b1.x!=null && d.b1.y!=null)
			beziers.push({bezier: 1,
				      x: d.b1.x,
				      y: d.b1.y,
				      reaction_id: reaction_id,
				      segment_id: segment_id });
		    if (d.b2!=null && d.b2.x!=null && d.b2.y!=null)
			beziers.push({bezier: 2,
				      x: d.b2.x,
				      y: d.b2.y,
				      reaction_id: reaction_id,
				      segment_id: segment_id });
		    return beziers;
		}, function(d) { return d.bezier; });
	bez.enter().call(function(sel) {
	    return create_bezier(sel);
	});
	// update bezier points
	bez.call(function(sel) { return update_bezier(sel, show_beziers, bezier_drag_behavior); });
	// remove
	bez.exit().remove();

	function create_bezier(enter_selection) {
	    utils.check_undefined(arguments, ['enter_selection']);

	    enter_selection.append('circle')
	    	.attr('class', function(d) { return 'bezier bezier'+d.bezier; })
	    	.style('stroke-width', String(1)+'px')	
    		.attr('r', String(5)+'px')
		.on("mouseover", function(d) {
		    d3.select(this).style('stroke-width', String(3)+'px');
		})
		.on("mouseout", function(d) {
		    d3.select(this).style('stroke-width', String(1)+'px');
		});
	}
	function update_bezier(update_selection, show_beziers, drag_behavior) {
	    utils.check_undefined(arguments, ['update_selection', 'show_beziers', 'drag_behavior']);
	    
	    update_selection
		.call(turn_off_drag)
		.call(drag_behavior);
	    if (show_beziers) {
	    	// draw bezier points
		update_selection
		    .attr('visibility', 'visible')
		    .attr('transform', function(d) {
	    		if (d.x==null || d.y==null) return ""; 
			return 'translate('+d.x+','+d.y+')';
		    });
	    } else {
	    	update_selection.attr('visibility', 'hidden');
	    }
	}
    }

    function create_node(enter_selection, drawn_nodes, drawn_reactions) {
	utils.check_undefined(arguments,
			      ['enter_selection', 'drawn_nodes',
			       'drawn_reactions']);

        // create nodes
        var g = enter_selection
                .append('g')
                .attr('class', 'node')
                .attr('id', function(d) { return 'n'+d.node_id; });

        // create metabolite circle and label
        g.append('circle')
	    .attr('class', function(d) {
		if (d.node_type=='metabolite') return 'node-circle metabolite-circle';
		else return 'node-circle';
	    })		
            .style('stroke-width', String(2)+'px')
	    .on("mouseover", function(d) {
		d3.select(this).style('stroke-width', String(3)+'px');
	    })
	    .on("mouseout", function(d) {
		d3.select(this).style('stroke-width', String(2)+'px');
	    });

        g.filter(function(d) { return d.node_type=='metabolite'; })
	    .append('text')
	    .attr('class', 'node-label label')
	    .style('cursor', 'default');
    }

    function update_node(update_selection, scale, has_metabolite_data, metabolite_data_styles,
			 click_fn, drag_behavior, label_drag_behavior) {
	utils.check_undefined(arguments,
			      ['update_selection', 'scale', 'has_metabolite_data',
			       'metabolite_data_styles', 'click_fn',
			       'drag_behavior', 'label_drag_behavior']);

        // update circle and label location
        var mg = update_selection
                .select('.node-circle')
                .attr('transform', function(d) {
                    return 'translate('+d.x+','+d.y+')';
                })
		.attr('r', function(d) {
		    if (d.node_type == 'metabolite') {
			if (has_metabolite_data && metabolite_data_styles.indexOf('Size')!==-1) {
			    var f = d.data;
			    return scale.metabolite_size(f===null ? 0 : f);
			} else {
			    return d.node_is_primary ? 15 : 10; 
			}
		    } else {
			return 5;
		    }
		})
		.style('fill', function(d) {
		    if (d.node_type=='metabolite') {
			if (has_metabolite_data && metabolite_data_styles.indexOf('Color')!==-1) {
			    var f = d.data;
			    return scale.metabolite_color(f===null ? 0 : f);
			} else {
			    return 'rgb(224, 134, 91)';
			}
		    }
		    return null;
		})
		.call(turn_off_drag)
		.call(drag_behavior)
		.on("click", click_fn);

        update_selection
            .select('.node-label')
            .attr('transform', function(d) {
                return 'translate('+d.label_x+','+d.label_y+')';
            })
            .style("font-size", function(d) {
		return String(20)+"px";
            })
            .text(function(d) {	
		var t = d.bigg_id;
		if (has_metabolite_data)
		    t += ' ' + d.data_string;
		return t;
	    })
	    .call(turn_off_drag)
	    .call(label_drag_behavior);
    }

    function create_text_label(enter_selection) {
	utils.check_undefined(arguments, ['enter_selection']);

	enter_selection.append('text')
	    .attr('class', 'text-label label')
	    .style('cursor', 'default')
	    .text(function(d) { return d.text; });
    }

    function update_text_label(update_selection, label_click, label_drag_behavior) {
	utils.check_undefined(arguments, ['update_selection', 'label_click', 'label_drag_behavior']);

        update_selection
            .attr("transform", function(d) { return "translate("+d.x+","+d.y+")";})
	    .on('click', label_click)
	    .call(turn_off_drag)
	    .call(label_drag_behavior);
    }

    function displaced_coords(reaction_arrow_displacement, start, end, displace) {
	utils.check_undefined(arguments, ['reaction_arrow_displacement', 'start', 'end', 'displace']);

	var length = reaction_arrow_displacement,
	    hyp = utils.distance(start, end),
	    new_x, new_y;
	if (!length || !hyp) console.error('Bad value');
	if (displace=='start') {
	    new_x = start.x + length * (end.x - start.x) / hyp,
	    new_y = start.y + length * (end.y - start.y) / hyp;
	} else if (displace=='end') {
	    new_x = end.x - length * (end.x - start.x) / hyp,
	    new_y = end.y - length * (end.y - start.y) / hyp;
	} else { console.error('bad displace value: ' + displace); }
	return {x: new_x, y: new_y};
    }
});

define('build',["utils"], function(utils) {
    return { new_reaction: new_reaction,
	     rotate_nodes: rotate_nodes,
	     move_node_and_dependents: move_node_and_dependents };
    
    // definitions
    function new_reaction(bigg_id, cobra_reaction, cobra_metabolites,
			  selected_node_id, selected_node,
			  largest_ids, cofactors, angle) {
        /** New reaction.

	 angle: clockwise from 'right', in degrees

	 */
	
	// rotate the new reaction around the selected metabolite
	// convert to radians
	angle = Math.PI / 180 * angle;

	// generate a new integer id
	var new_reaction_id = String(++largest_ids.reactions);

        // calculate coordinates of reaction
	var selected_node_coords = { x: selected_node.x,
				     y: selected_node.y };
		
	// rotate main axis around angle with distance
	var reaction_length = 300,
            main_axis = [ selected_node_coords,
			  utils.c_plus_c(selected_node_coords,
					 {'x': reaction_length, 'y': 0}) ],
	    center = { 'x': (main_axis[0].x + main_axis[1].x)/2,  
                       'y': (main_axis[0].y + main_axis[1].y)/2 };
	    
	// relative label location
	var label_d;
	if (Math.abs(angle) < Math.PI/4 ||
	    Math.abs(angle - Math.PI) < Math.PI/4 ) {
	    label_d = { x: -50, y: -40 };
	} else {
	    label_d = { x: 30, y: 10 };
	}

	// relative anchor node distance
	var anchor_distance = 20;

	// new reaction structure
	var new_reaction = { bigg_id: bigg_id,
			     reversibility: cobra_reaction.reversibility,
			     metabolites: utils.clone(cobra_reaction.metabolites),
			     label_x: center.x + label_d.x,
			     label_y: center.y + label_d.y,
			     name: cobra_reaction.name,
			     segments: {} };

        // set primary metabolites and count reactants/products

	// look for the selected metabolite, and record the indices
	var reactant_ranks = [], product_ranks = [], 
            reactant_count = 0, product_count = 0,
	    reaction_is_reversed = false;
        for (var met_bigg_id in new_reaction.metabolites) {	
	    // make the metabolites into objects
            var metabolite = cobra_metabolites[met_bigg_id],
		coefficient = new_reaction.metabolites[met_bigg_id],
		formula = metabolite.formula,
		new_metabolite = { coefficient: coefficient,
				   bigg_id: met_bigg_id,
				   name: metabolite.name };
	    if (coefficient < 0) {
                new_metabolite.index = reactant_count;
		// score the metabolites. Infinity == selected, >= 1 == carbon containing
		var carbons = /C([0-9]+)/.exec(formula);
		if (selected_node.bigg_id==new_metabolite.bigg_id) {
		    reactant_ranks.push([new_metabolite.index, Infinity]);
		} else if (carbons && cofactors.indexOf(utils.decompartmentalize(new_metabolite.bigg_id)[0])==-1) {
		    reactant_ranks.push([new_metabolite.index, parseInt(carbons[1])]);
		}
                reactant_count++;
	    } else {
                new_metabolite.index = product_count;
		var carbons = /C([0-9]+)/.exec(formula);
		if (selected_node.bigg_id==new_metabolite.bigg_id) {
		    product_ranks.push([new_metabolite.index, Infinity]);
		    reaction_is_reversed = true;
		} else if (carbons && cofactors.indexOf(utils.decompartmentalize(new_metabolite.bigg_id)[0])==-1) {
		    product_ranks.push([new_metabolite.index, parseInt(carbons[1])]);
		}
                product_count++;
	    }
	    new_reaction.metabolites[met_bigg_id] = new_metabolite;
	}

	// get the rank with the highest score
	var max_rank = function(old, current) { return current[1] > old[1] ? current : old; },
            primary_reactant_index = reactant_ranks.reduce(max_rank, [0,0])[0],
            primary_product_index = product_ranks.reduce(max_rank, [0,0])[0];

	// set primary metabolites, and keep track of the total counts
        for (var met_bigg_id in new_reaction.metabolites) {
            var metabolite = new_reaction.metabolites[met_bigg_id];
            if (metabolite.coefficient < 0) {
                if (metabolite.index==primary_reactant_index) metabolite.is_primary = true;
		metabolite.count = reactant_count + 1;
            } else {
                if (metabolite.index==primary_product_index) metabolite.is_primary = true;
		metabolite.count = product_count + 1;
            }
        }

	// generate anchor nodes
	var new_anchors = {},
	    anchors = [ { node_type: 'anchor_reactants',
			  dis: { x: anchor_distance * (reaction_is_reversed ? 1 : -1), y: 0 } },
			{ node_type: 'center',
			  dis: { x: 0, y: 0 } },
			{ node_type: 'anchor_products',
			  dis: { x: anchor_distance * (reaction_is_reversed ? -1 : 1), y: 0 } } ],
	    anchor_ids = {};
	anchors.map(function(n) {
	    var new_id = String(++largest_ids.nodes),
		general_node_type = (n.node_type=='center' ? 'midmarker' : 'multimarker');
	    new_anchors[new_id] = { node_type: general_node_type,
				    x: center.x + n.dis.x,
				    y: center.y + n.dis.y,
				    connected_segments: [],
				    name: null,
				    bigg_id: null,
				    label_x: null,
				    label_y: null,
				    node_is_primary: null };
	    anchor_ids[n.node_type] = new_id;
	});

	// add the segments, outside to inside
	var new_anchor_groups = [ [ anchor_ids['anchor_reactants'], anchor_ids['center'] ],
				  [ anchor_ids['anchor_products'],  anchor_ids['center'] ] ];
	new_anchor_groups.map(function(l) {
	    var from_id = l[0], to_id = l[1],
		new_segment_id = String(++largest_ids.segments);
	    new_reaction.segments[new_segment_id] =  { b1: null,
						       b2: null,
						       from_node_id: from_id,
						       to_node_id: to_id,
						       from_node_coefficient: null,
						       to_node_coefficient: null,
						       reversibility: new_reaction.reversibility };
	    new_anchors[from_id].connected_segments.push({ segment_id: new_segment_id,
							   reaction_id: new_reaction_id });
	    new_anchors[to_id].connected_segments.push({ segment_id: new_segment_id,
							 reaction_id: new_reaction_id });
	});

        // Add the metabolites, keeping track of total reactants and products.
	var new_nodes = new_anchors;
        for (var met_bigg_id in new_reaction.metabolites) {
            var metabolite = new_reaction.metabolites[met_bigg_id],
		primary_index, from_node_id;
            if (metabolite.coefficient < 0) {
                // metabolite.count = reactant_count + 1;
                primary_index = primary_reactant_index;
		from_node_id = anchor_ids['anchor_reactants'];
            } else {
                // metabolite.count = product_count + 1;
                primary_index = primary_product_index;
		from_node_id = anchor_ids['anchor_products'];
            }
	    
            // calculate coordinates of metabolite components
            var met_loc = calculate_new_metabolite_coordinates(metabolite,
							       primary_index,
							       main_axis,
							       center,
							       reaction_length,
							       reaction_is_reversed);

	    // if this is the existing metabolite
	    if (selected_node.bigg_id==metabolite.bigg_id) {
		var new_segment_id = String(++largest_ids.segments);
		new_reaction.segments[new_segment_id] = { b1: met_loc.b1,
							  b2: met_loc.b2,
							  from_node_id: from_node_id,
							  to_node_id: selected_node_id,
							  from_node_coefficient: null,
							  to_node_coefficient: metabolite.coefficient,
							  reversibility: new_reaction.reversibility };
		// update the existing node
		selected_node.connected_segments.push({ segment_id: new_segment_id,
							reaction_id: new_reaction_id });
		new_nodes[from_node_id].connected_segments.push({ segment_id: new_segment_id,
								  reaction_id: new_reaction_id });
	    } else {
		// save new metabolite
		var new_segment_id = String(++largest_ids.segments),
		    new_node_id = String(++largest_ids.nodes);
		new_reaction.segments[new_segment_id] = { b1: met_loc.b1,
							  b2: met_loc.b2,
							  from_node_id: from_node_id,
							  to_node_id: new_node_id,
							  from_node_coefficient: null,
							  to_node_coefficient: metabolite.coefficient,
							  reversibility: new_reaction.reversibility };
		// save new node
		new_nodes[new_node_id] = { connected_segments: [{ segment_id: new_segment_id,
								  reaction_id: new_reaction_id }],
					   x: met_loc.circle.x,
					   y: met_loc.circle.y,
					   node_is_primary: Boolean(metabolite.is_primary),
					   label_x: met_loc.circle.x + label_d.x,
					   label_y: met_loc.circle.y + label_d.y,
					   name: metabolite.name,
					   bigg_id: metabolite.bigg_id,
					   node_type: 'metabolite' };
		new_nodes[from_node_id].connected_segments.push({ segment_id: new_segment_id,
								  reaction_id: new_reaction_id });
	    }
	}

	// now take out the extra reaction details
	for (var bigg_id in new_reaction.metabolites) {
	    new_reaction.metabolites[bigg_id] = {
		coefficient: new_reaction.metabolites[bigg_id].coefficient
	    };
	}

	// new_reactions object
	var new_reactions = {};
	new_reactions[new_reaction_id] = new_reaction;
	
	// add the selected node for rotation, and return it as a new (updated) node
	new_nodes[selected_node_id] = selected_node;
	var updated = rotate_nodes(new_nodes, new_reactions,
				   angle, selected_node_coords);

	return { new_reactions: new_reactions,
		 new_nodes: new_nodes };
    }

    function rotate_nodes(selected_nodes, reactions, angle, center) {
	/** Rotate the nodes around center.

	 selected_nodes: Nodes to rotate.
	 reactions: Only updates beziers for these reactions.
	 angle: Angle to rotate in radians.
	 center: Point to rotate around.

	 */
	
	// functions
	var rotate_around = function(coord) {
	    if (coord === null)
		return null;
	    return utils.rotate_coords(coord, angle, center);
	};

	// recalculate: node
	var updated_node_ids = [], updated_reaction_ids = [];
	for (var node_id in selected_nodes) {
	    var node = selected_nodes[node_id],
		// rotation distance
		displacement = rotate_around({ x: node.x, y: node.y }),
		// move the node
		updated = move_node_and_labels(node, reactions,
						   displacement);
	    // move the bezier points
	    node.connected_segments.map(function(segment_obj) {
		var reaction = reactions[segment_obj.reaction_id];
		// If the reaction was not passed in the reactions argument, then ignore
		if (reaction === undefined) return;

		// rotate the beziers
		var segment = reaction.segments[segment_obj.segment_id];
		if (segment.to_node_id==node_id && segment.b2) {
		    var displacement = rotate_around(segment.b2);
		    segment.b2 = utils.c_plus_c(segment.b2, displacement);
		} else if (segment.from_node_id==node_id && segment.b1) {
		    var displacement = rotate_around(segment.b1);
		    segment.b1 = utils.c_plus_c(segment.b1, displacement);
		}
	    });

	    updated_reaction_ids = utils.unique_concat([updated_reaction_ids,
							updated.reaction_ids]);
	    updated_node_ids.push(node_id);
	}

	return { node_ids: updated_node_ids,
		 reaction_ids: updated_reaction_ids };
    }
    
    function move_node_and_dependents(node, node_id, reactions, displacement) {
	/** Move the node and its labels and beziers.

	 */
	var updated = move_node_and_labels(node, reactions, displacement);

	// move beziers
	node.connected_segments.map(function(segment_obj) {
	    var reaction = reactions[segment_obj.reaction_id];
	    // If the reaction was not passed in the reactions argument, then ignore
	    if (reaction === undefined) return;

	    // update beziers
	    var segment = reaction.segments[segment_obj.segment_id];
	    if (segment.from_node_id==node_id && segment.b1) {
		segment.b1 = utils.c_plus_c(segment.b1, displacement);
	    }
	    if (segment.to_node_id==node_id && segment.b2) {
		segment.b2 = utils.c_plus_c(segment.b2, displacement);
	    }
	    // add to list of updated reaction ids if it isn't already there
	    if (updated.reaction_ids.indexOf(segment_obj.reaction_id) < 0) {
	        updated.reaction_ids.push(segment_obj.reaction_id);
	    }
	});
	return updated;
    }

    function move_node_and_labels(node, reactions, displacement) {
	node.x = node.x + displacement.x;
	node.y = node.y + displacement.y;
	    
	// recalculate: node label
	node.label_x = node.label_x + displacement.x;
	node.label_y = node.label_y + displacement.y;

	// recalculate: reaction label
	var updated_reaction_ids = [];
	node.connected_segments.map(function(segment_obj) {
	    var reaction = reactions[segment_obj.reaction_id];
	    // add to list of updated reaction ids if it isn't already there
	    if (updated_reaction_ids.indexOf(segment_obj.reaction_id) < 0) {
		updated_reaction_ids.push(segment_obj.reaction_id);

		// update reaction label (but only once per reaction
		if (node.node_type == 'midmarker') {
		    reaction.label_x = reaction.label_x + displacement.x;
		    reaction.label_y = reaction.label_y + displacement.y;
		}
	    }
	});
	return { reaction_ids: updated_reaction_ids };
    }

    function calculate_new_metabolite_coordinates(met, primary_index, main_axis, center, dis, is_reversed) {
	/** Calculate metabolite coordinates for a new reaction metabolite.

	 */
	// new local coordinate system
	var displacement = main_axis[0],
	    main_axis = [utils.c_minus_c(main_axis[0], displacement),
			 utils.c_minus_c(main_axis[1], displacement)],
	    center = utils.c_minus_c(center, displacement);
	
        // Curve parameters
        var w = 80,  // distance between reactants and between products
            b1_strength = 0.4,
            b2_strength = 0.25,
            w2 = w*0.7,
            secondary_dis = 40,
            num_slots = Math.min(2, met.count - 1);

        // size and spacing for primary and secondary metabolites
        var ds, draw_at_index, r;
        if (met.is_primary) { // primary
            ds = 20;
        } else { // secondary
            ds = 10;
            // don't use center slot
            if (met.index > primary_index) draw_at_index = met.index - 1;
            else draw_at_index = met.index;
        }

        var de = dis - ds, // distance between ends of line axis
            reaction_axis = [{'x': ds, 'y': 0},
                             {'x': de, 'y': 0}];

        // Define line parameters and axis.
        // Begin with unrotated coordinate system. +y = Down, +x = Right. 
        var end, circle, b1, b2;
        // reactants
        if (((met.coefficient < 0) != is_reversed) && met.is_primary) { // Ali == BADASS
            end = {'x': reaction_axis[0].x,
                   'y': reaction_axis[0].y};
            b1 = {'x': center.x*(1-b1_strength) + reaction_axis[0].x*b1_strength,
                  'y': center.y*(1-b1_strength) + reaction_axis[0].y*b1_strength};
            b2 = {'x': center.x*b2_strength + (end.x)*(1-b2_strength),
                  'y': center.y*b2_strength + (end.y)*(1-b2_strength)},
            circle = {'x': main_axis[0].x,
                      'y': main_axis[0].y};
        } else if ((met.coefficient < 0) != is_reversed) {
	    end = {'x': reaction_axis[0].x + secondary_dis,
                   'y': reaction_axis[0].y + (w2*draw_at_index - w2*(num_slots-1)/2)},
            b1 = {'x': center.x*(1-b1_strength) + reaction_axis[0].x*b1_strength,
                  'y': center.y*(1-b1_strength) + reaction_axis[0].y*b1_strength},
            b2 = {'x': center.x*b2_strength + end.x*(1-b2_strength),
                  'y': center.y*b2_strength + end.y*(1-b2_strength)},
            circle = {'x': main_axis[0].x + secondary_dis,
                      'y': main_axis[0].y + (w*draw_at_index - w*(num_slots-1)/2)};
        } else if (((met.coefficient > 0) != is_reversed) && met.is_primary) {        // products
            end = {'x': reaction_axis[1].x,
                   'y': reaction_axis[1].y};
            b1 = {'x': center.x*(1-b1_strength) + reaction_axis[1].x*b1_strength,
                  'y': center.y*(1-b1_strength) + reaction_axis[1].y*b1_strength};
            b2 = {'x': center.x*b2_strength + end.x*(1-b2_strength),
                  'y': center.y*b2_strength + end.y*(1-b2_strength)},
            circle = {'x': main_axis[1].x,
                      'y': main_axis[1].y};
        } else if ((met.coefficient > 0) != is_reversed) {
            end = {'x': reaction_axis[1].x - secondary_dis,
                   'y': reaction_axis[1].y + (w2*draw_at_index - w2*(num_slots-1)/2)},
            b1 = {'x': center.x*(1-b1_strength) + reaction_axis[1].x*b1_strength,
                  'y': center.y*(1-b1_strength) + reaction_axis[1].y*b1_strength};
            b2 = {'x': center.x*b2_strength + end.x*(1-b2_strength),
                  'y': center.y*b2_strength + end.y*(1-b2_strength)},
            circle = {'x': main_axis[1].x - secondary_dis,
                      'y': main_axis[1].y + (w*draw_at_index - w*(num_slots-1)/2)};
        }
	var loc = {};
	loc.b1 = utils.c_plus_c(displacement, b1);
	loc.b2 = utils.c_plus_c(displacement, b2);
	loc.circle = utils.c_plus_c(displacement, circle);
        return loc;
    }
});

define('Behavior',["utils", "build"], function(utils, build) {
    /** Defines the set of click and drag behaviors for the map, and keeps track
     of which behaviors are activated.

     Has the following attributes:

     Behavior.node_click
     Behavior.node_drag
     Behavior.bezier_drag
     Behavior.label_drag
     */

    var Behavior = utils.make_class();
    Behavior.prototype = { init: init,
			   turn_everything_on: turn_everything_on,
			   turn_everything_off: turn_everything_off,
			   toggle_node_click: toggle_node_click,
			   toggle_node_drag: toggle_node_drag,
			   toggle_text_label_click: toggle_text_label_click,
			   toggle_label_drag: toggle_label_drag,
			   get_node_drag: get_node_drag,
			   get_bezier_drag: get_bezier_drag,
			   get_reaction_label_drag: get_reaction_label_drag,
			   get_node_label_drag: get_node_label_drag,
			   get_text_label_drag: get_text_label_drag,
			   get_generic_drag: get_generic_drag };

    return Behavior;

    // definitions
    function init(map, undo_stack) {
	this.map = map;
	this.undo_stack = undo_stack;

	// make an empty function that can be called as a behavior and does nothing
	this.empty_behavior = function() {};

	// init empty
	this.node_click = null;
	this.node_drag = this.empty_behavior;
	this.bezier_drag = this.empty_behavior;
	this.reaction_label_drag = this.empty_behavior;
	this.node_label_drag = this.empty_behavior;
	this.text_label_click = null;
	this.text_label_drag = this.empty_behavior;
	this.turn_everything_on();
    }
    function turn_everything_on() {
	this.toggle_node_click(true);
	this.toggle_node_drag(true);
	this.toggle_text_label_click(true);
	this.toggle_label_drag(true);
    }
    function turn_everything_off() {
	this.toggle_node_click(false);
	this.toggle_node_drag(false);
	this.toggle_text_label_click(false);
	this.toggle_label_drag(false);
    }
    function toggle_node_click(on_off) {
	/** With no argument, toggle the node click on or off.

	 Pass in a boolean argument to set the on/off state.

	 */
	if (on_off===undefined) on_off = this.node_click==null;
	if (on_off) {
	    var map = this.map;
	    this.node_click = function(d) {
		map.select_metabolite(this, d);
		d3.event.stopPropagation();
	    };
	} else {
	    this.node_click = null;
	}
    }
    function toggle_text_label_click(on_off) {
	/** With no argument, toggle the node click on or off.

	 Pass in a boolean argument to set the on/off state.

	 */
	if (on_off===undefined) on_off = this.text_label_click==null;
	if (on_off) {
	    var map = this.map;
	    this.text_label_click = function(d) {
		map.select_text_label(this, d);
		d3.event.stopPropagation();
	    };
	} else {
	    this.text_label_click = null;
	}
    }
    function toggle_node_drag(on_off) {
	/** With no argument, toggle the node drag & bezier drag on or off.

	 Pass in a boolean argument to set the on/off state.

	 */
	if (on_off===undefined) on_off = this.node_drag===this.empty_behavior;
	if (on_off) {
	    this.node_drag = this.get_node_drag(this.map, this.undo_stack);
	    this.bezier_drag = this.get_bezier_drag(this.map, this.undo_stack);
	} else {
	    this.node_drag = this.empty_behavior;
	}
    }
    function toggle_label_drag(on_off) {
	/** With no argument, toggle the label drag on or off.

	 Pass in a boolean argument to set the on/off state.

	 */
	if (on_off===undefined) on_off = this.label_drag===this.empty_behavior;
	if (on_off) {
	    this.reaction_label_drag = this.get_reaction_label_drag(this.map);
	    this.node_label_drag = this.get_node_label_drag(this.map);
	    this.text_label_drag = this.get_text_label_drag(this.map);
	} else {
	    this.reaction_label_drag = this.empty_behavior;
	    this.node_label_drag = this.empty_behavior;
	    this.text_label_drag = this.empty_behavior;
	}
    }

    function get_node_drag(map, undo_stack) {
	// define some variables
	var behavior = d3.behavior.drag(),
	    total_displacement = null,
	    nodes_to_drag = null,
	    reaction_ids = null,
	    the_timeout = null;

        behavior.on("dragstart", function () { 
	    // Note that dragstart is called even for a click event
	    var data = this.parentNode.__data__,
		bigg_id = data.bigg_id,
		node_group = this.parentNode;
	    // silence other listeners
	    d3.event.sourceEvent.stopPropagation();
	    // remember the total displacement for later
	    total_displacement = {};
	    // Move element to back (for the next step to work). Wait 200ms
	    // before making the move, becuase otherwise the element will be
	    // deleted before the click event gets called, and selection
	    // will stop working.
	    the_timeout = window.setTimeout(function() {
		node_group.parentNode.insertBefore(node_group,node_group.parentNode.firstChild);
	    }, 200);
	    // prepare to combine metabolites
	    map.sel.selectAll('.metabolite-circle')
		.on('mouseover.combine', function(d) {
		    if (d.bigg_id==bigg_id && d.node_id!=data.node_id) {
			d3.select(this).style('stroke-width', String(12)+'px')
			    .classed('node-to-combine', true);
		    }
		}).on('mouseout.combine', function(d) {
		    if (d.bigg_id==bigg_id) {
			map.sel.selectAll('.node-to-combine').style('stroke-width', String(2)+'px')
			    .classed('node-to-combine', false);
		    }
		});
	});
        behavior.on("drag", function() {
	    var grabbed_id = this.parentNode.__data__.node_id, 
		selected_ids = map.get_selected_node_ids();
	    nodes_to_drag = [];
	    // choose the nodes to drag
	    if (selected_ids.indexOf(grabbed_id)==-1) { 
		nodes_to_drag.push(grabbed_id);
	    } else {
		nodes_to_drag = selected_ids;
	    }
	    reaction_ids = [];
	    nodes_to_drag.forEach(function(node_id) {
		// update data
		var node = map.nodes[node_id],
		    displacement = { x: d3.event.dx,
				     y: d3.event.dy },
		    updated = build.move_node_and_dependents(node, node_id, map.reactions, displacement);
		reaction_ids = utils.unique_concat([reaction_ids, updated.reaction_ids]);
		// remember the displacements
		if (!(node_id in total_displacement))  total_displacement[node_id] = { x: 0, y: 0 };
		total_displacement[node_id] = utils.c_plus_c(total_displacement[node_id], displacement);
	    });
	    // draw
	    map.draw_these_nodes(nodes_to_drag);
	    map.draw_these_reactions(reaction_ids);
	});
	behavior.on("dragend", function() {
	    if (nodes_to_drag===null) {
		// Dragend can be called when drag has not been called. In this,
		// case, do nothing.
		total_displacement = null;
		nodes_to_drag = null;
		reaction_ids = null;
		the_timeout = null;
		return;
	    }
	    // look for mets to combine
	    var node_to_combine_array = [];
	    map.sel.selectAll('.node-to-combine').each(function(d) {
		node_to_combine_array.push(d.node_id);
	    });
	    if (node_to_combine_array.length==1) {
		// If a node is ready for it, combine nodes
		var fixed_node_id = node_to_combine_array[0],
		    dragged_node_id = this.parentNode.__data__.node_id,
		    saved_dragged_node = utils.clone(map.nodes[dragged_node_id]),
		    segment_objs_moved_to_combine = combine_nodes_and_draw(fixed_node_id,
									   dragged_node_id);
		undo_stack.push(function() {
		    // undo
		    // put the old node back
		    map.nodes[dragged_node_id] = saved_dragged_node;
		    var fixed_node = map.nodes[fixed_node_id],
			updated_reactions = [];
		    segment_objs_moved_to_combine.forEach(function(segment_obj) {
			var segment = map.reactions[segment_obj.reaction_id].segments[segment_obj.segment_id];
			if (segment.from_node_id==fixed_node_id) {
			    segment.from_node_id = dragged_node_id;
			} else if (segment.to_node_id==fixed_node_id) {
			    segment.to_node_id = dragged_node_id;
			} else {
			    console.error('Segment does not connect to fixed node');
			}
			// removed this segment_obj from the fixed node
			fixed_node.connected_segments = fixed_node.connected_segments.filter(function(x) {
			    return !(x.reaction_id==segment_obj.reaction_id && x.segment_id==segment_obj.segment_id);
			});
			if (updated_reactions.indexOf(segment_obj.reaction_id)==-1)
			    updated_reactions.push(segment_obj.reaction_id);
		    });
		    map.draw_these_nodes([dragged_node_id]);
		    map.draw_these_reactions(updated_reactions);
		}, function () {
		    // redo
		    combine_nodes_and_draw(fixed_node_id, dragged_node_id);
		});

	    } else {
		// otherwise, drag node
		
		// add to undo/redo stack
		// remember the displacement, dragged nodes, and reactions
		var saved_displacement = utils.clone(total_displacement), 
		    // BUG TODO this variable disappears!
		    // Happens sometimes when you drag a node, then delete it, then undo twice
		    saved_node_ids = utils.clone(nodes_to_drag),
		    saved_reaction_ids = utils.clone(reaction_ids);
		undo_stack.push(function() {
		    // undo
		    saved_node_ids.forEach(function(node_id) {
			var node = map.nodes[node_id];
			build.move_node_and_dependents(node, node_id, map.reactions,
						       utils.c_times_scalar(saved_displacement[node_id], -1));
		    });
		    map.draw_these_nodes(saved_node_ids);
		    map.draw_these_reactions(saved_reaction_ids);
		}, function () {
		    // redo
		    saved_node_ids.forEach(function(node_id) {
			var node = map.nodes[node_id];
			build.move_node_and_dependents(node, node_id, map.reactions,
						       saved_displacement[node_id]);
		    });
		    map.draw_these_nodes(saved_node_ids);
		    map.draw_these_reactions(saved_reaction_ids);
		});
	    }

	    // stop combining metabolites
	    map.sel.selectAll('.metabolite-circle')
		.on('mouseover.combine', null)
		.on('mouseout.combine', null);

	    // clear the timeout
	    window.clearTimeout(the_timeout);

	    // clear the shared variables
	    total_displacement = null;
	    nodes_to_drag = null;
	    reaction_ids = null;
	    the_timeout = null;
	});
	return behavior;

	// definitions
	function combine_nodes_and_draw(fixed_node_id, dragged_node_id) {
	    var dragged_node = map.nodes[dragged_node_id],
		fixed_node = map.nodes[fixed_node_id],
		updated_segment_objs = [];
	    dragged_node.connected_segments.forEach(function(segment_obj) {
		// change the segments to reflect
		var segment = map.reactions[segment_obj.reaction_id].segments[segment_obj.segment_id];
		if (segment.from_node_id==dragged_node_id) segment.from_node_id = fixed_node_id;
		else if (segment.to_node_id==dragged_node_id) segment.to_node_id = fixed_node_id;
		else return console.error('Segment does not connect to dragged node');
		// moved segment_obj to fixed_node
		fixed_node.connected_segments.push(segment_obj);
		updated_segment_objs.push(utils.clone(segment_obj));
	    });
	    // delete the old node
	    var to_delete = {};
	    to_delete[dragged_node_id] = dragged_node;
	    map.delete_node_data(to_delete);
	    // turn off the class
	    map.sel.selectAll('.node-to-combine').classed('node-to-combine', false);
	    // draw
	    map.draw_everything();
	    // return for undo
	    return updated_segment_objs;
	}
    }
    function get_bezier_drag(map) {
	var move_bezier = function(reaction_id, segment_id, bezier, displacement) {
	    var segment = map.reactions[reaction_id].segments[segment_id];
	    segment['b'+bezier] = utils.c_plus_c(segment['b'+bezier], displacement);
	},
	    start_fn = function(d) {
	    },
	    drag_fn = function(d, displacement, total_displacement) {
		// draw
		move_bezier(d.reaction_id, d.segment_id, d.bezier, displacement);
		map.draw_these_reactions([d.reaction_id]);
	    },
	    end_fn = function(d) {
	    },
	    undo_fn = function(d, displacement) {
		move_bezier(d.reaction_id, d.segment_id, d.bezier,
			    utils.c_times_scalar(displacement, -1));
		map.draw_these_reactions([d.reaction_id]);
	    },
	    redo_fn = function(d, displacement) {
		move_bezier(d.reaction_id, d.segment_id, d.bezier, displacement);
		map.draw_these_reactions([d.reaction_id]);
	    };
	return this.get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn);
    }
    function get_reaction_label_drag(map) {
	var move_label = function(reaction_id, displacement) {
	    var reaction = map.reactions[reaction_id];
	    reaction.label_x = reaction.label_x + displacement.x;
	    reaction.label_y = reaction.label_y + displacement.y;
	},
	    start_fn = function(d) {
	    },
	    drag_fn = function(d, displacement, total_displacement) {
		// draw
		move_label(d.reaction_id, displacement);
		map.draw_these_reactions([d.reaction_id]);
	    },
	    end_fn = function(d) {
	    },
	    undo_fn = function(d, displacement) {
		move_label(d.reaction_id, utils.c_times_scalar(displacement, -1));
		map.draw_these_reactions([d.reaction_id]);
	    },
	    redo_fn = function(d, displacement) {
		move_label(d.reaction_id, displacement);
		map.draw_these_reactions([d.reaction_id]);
	    };
	return this.get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn);
    }
    function get_node_label_drag(map) {
	var move_label = function(node_id, displacement) {
	    var node = map.nodes[node_id];
	    node.label_x = node.label_x + displacement.x;
	    node.label_y = node.label_y + displacement.y;
	},
	    start_fn = function(d) {
	    },
	    drag_fn = function(d, displacement, total_displacement) {
		// draw
		move_label(d.node_id, displacement);
		map.draw_these_nodes([d.node_id]);
	    },
	    end_fn = function(d) {
	    },
	    undo_fn = function(d, displacement) {
		move_label(d.node_id, utils.c_times_scalar(displacement, -1));
		map.draw_these_nodes([d.node_id]);
	    },
	    redo_fn = function(d, displacement) {
		move_label(d.node_id, displacement);
		map.draw_these_nodes([d.node_id]);
	    };
	return this.get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn);
    }
    function get_text_label_drag(map) {
	var move_label = function(text_label_id, displacement) {
	    var text_label = map.text_labels[text_label_id];
	    text_label.x = text_label.x + displacement.x;
	    text_label.y = text_label.y + displacement.y;
	},
	    start_fn = function(d) {
	    },
	    drag_fn = function(d, displacement, total_displacement) {
		// draw
		move_label(d.text_label_id, displacement);
		map.draw_these_text_labels([d.text_label_id]);
	    },
	    end_fn = function(d) {
	    },
	    undo_fn = function(d, displacement) {
		move_label(d.text_label_id, utils.c_times_scalar(displacement, -1));
		map.draw_these_text_labels([d.text_label_id]);
	    },
	    redo_fn = function(d, displacement) {
		move_label(d.text_label_id, displacement);
		map.draw_these_text_labels([d.text_label_id]);
	    };
	return this.get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn);
    }
    function get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn) {
	/** Make a generic drag behavior, with undo/redo.

	 start_fn: function(d) Called at dragstart.

	 drag_fn: function(d, displacement, total_displacement) Called during
	 drag.

	 end_fn

	 undo_fn

	 redo_fn

	 */
	 
	// define some variables
	var behavior = d3.behavior.drag(),
	    total_displacement,
	    undo_stack = this.undo_stack;

        behavior.on("dragstart", function (d) {
	    // silence other listeners
	    d3.event.sourceEvent.stopPropagation();
	    total_displacement = { x: 0, y: 0 };
	    start_fn(d);
	});
        behavior.on("drag", function(d) {
	    // update data
	    var displacement = { x: d3.event.dx,
				 y: d3.event.dy };
	    // remember the displacement
	    total_displacement = utils.c_plus_c(total_displacement, displacement);
	    drag_fn(d, displacement, total_displacement);
	});
	behavior.on("dragend", function(d) {			  
	    // add to undo/redo stack
	    // remember the displacement, dragged nodes, and reactions
	    var saved_d = utils.clone(d),
		saved_displacement = utils.clone(total_displacement); // BUG TODO this variable disappears!
	    undo_stack.push(function() {
		// undo
		undo_fn(saved_d, saved_displacement);
	    }, function () {
		// redo
		redo_fn(saved_d, saved_displacement);
	    });
	    end_fn(d);
	});
	return behavior;
    }
});

define('Scale',["utils"], function(utils) {
    /** 
     */

    var Scale = utils.make_class();
    Scale.prototype = { init: init };

    return Scale;

    // definitions
    function init(options) { //map_w, map_h, w, h, options) {
	var sc = utils.set_options(options, 
				   { reaction_color: d3.scale.linear()
				     .domain([0, 0.000001, 1, 8, 50])
				     .range(["rgb(200,200,200)", "rgb(190,190,255)", 
					     "rgb(100,100,255)", "blue", "red"])});

	sc.x = d3.scale.linear();
	sc.y = d3.scale.linear();
	sc.x_size = d3.scale.linear();
	sc.y_size = d3.scale.linear();
	sc.size = d3.scale.linear();
        sc.reaction_size = d3.scale.linear()
            .domain([0, 40])
            .range([6, 12]),
	sc.metabolite_size = d3.scale.linear()
	    .range([8,15]),
	sc.metabolite_color = d3.scale.linear()
	    .range(["white", "red"]),
        sc.scale_path = function(path) {
            var x_fn = sc.x, y_fn = sc.y;
            // TODO: scale arrow width
            var str = d3.format(".2f"),
                path = path.replace(/(M|L)([0-9-.]+),?\s*([0-9-.]+)/g, function (match, p0, p1, p2) {
                    return p0 + [str(x_fn(parseFloat(p1))), str(y_fn(parseFloat(p2)))].join(', ');
                }),
                reg = /C([0-9-.]+),?\s*([0-9-.]+)\s*([0-9-.]+),?\s*([0-9-.]+)\s*([0-9-.]+),?\s*([0-9-.]+)/g;
            path = path.replace(reg, function (match, p1, p2, p3, p4, p5, p6) {
                return 'C'+str(x_fn(parseFloat(p1)))+','+
                    str(y_fn(parseFloat(p2)))+' '+
                    str(x_fn(parseFloat(p3)))+','+
                    str(y_fn(parseFloat(p4)))+' '+
                    [str(x_fn(parseFloat(p5)))+','+str(y_fn(parseFloat(p6)))];
            });
            return path;
        };
        sc.scale_decimals = function(path, scale_fn, precision) {
            var str = d3.format("."+String(precision)+"f");
            path = path.replace(/([0-9.]+)/g, function (match, p1) {
                return str(scale_fn(parseFloat(p1)));
            });
            return path;
        };

	// assign sc to this
	var keys = window.Object.keys(sc), i = -1;
        while (++i < keys.length) this[keys[i]] = sc[keys[i]];
    }
});

define('DirectionArrow',["utils"], function(utils) {
    /** DirectionArrow returns a constructor for an arrow that can be rotated
     and dragged, and supplies its direction.
     */
    var DirectionArrow = utils.make_class();
    DirectionArrow.prototype = { init: init,
				 set_location: set_location,
				 set_rotation: set_rotation,
				 get_rotation: get_rotation,
				 show: show,
				 hide: hide,
				 right: right,
				 left: left,
				 up: up,
				 down: down };
    return DirectionArrow;

    // definitions
    function init(sel) {
	this.arrow_container = sel.append('g')
	    .attr('id', 'direction-arrow-container')
	    .attr('transform', 'translate(0,0)rotate(0)');
	this.arrow = this.arrow_container.append('path')
	    .classed('direction-arrow', true)
	    .attr('d', path_for_arrow())
	    .style('visibility', 'hidden')
	    .attr('transform', 'translate(20,0)scale(1.5)');

	// definitions
	function path_for_arrow() {
	    return "M0 -5 L0 5 L20 5 L20 10 L30 0 L20 -10 L20 -5 Z";
	}
    }
    function set_location(coords) {
	/** Move the arrow to coords.
	 */
	var transform = d3.transform(this.arrow_container.attr('transform'));
	this.arrow_container.attr('transform',
				  'translate('+coords.x+','+coords.y+')rotate('+transform.rotate+')');
    }
    function set_rotation(rotation) {
	/** Rotate the arrow to rotation.
	 */
	var transform = d3.transform(this.arrow_container.attr('transform'));
	this.arrow_container.attr('transform',
				  'translate('+transform.translate+')rotate('+rotation+')');
    }
    function get_rotation() {
	/** Returns the arrow rotation.
	 */
	return d3.transform(this.arrow_container.attr('transform')).rotate;
    }
    function show() {
	this.arrow.style('visibility', 'visible');
    }
    function hide() {
	this.arrow.style('visibility', 'hidden');
    }
    function right() {
	this.set_rotation(0);
    }
    function down() {
	this.set_rotation(90);
    }
    function left() {
	this.set_rotation(180);
    }
    function up() {
	this.set_rotation(270);
    }
});

define('UndoStack',["utils"], function(utils) {
    /** UndoStack returns a constructor that can be used to store undo info.
     */
    var UndoStack = utils.make_class();
    UndoStack.prototype = { init: init,
			    push: push,
			    undo: undo,
			    redo: redo };
    return UndoStack;

    // definitions
    function init() {
	var stack_size = 40;
	this.stack = Array(stack_size);
	this.current = -1;
	this.oldest = -1;
	this.newest = -1;
	this.end_of_stack = true;
	this.top_of_stack = true;
    }
    function push(undo_fn, redo_fn) {
	this.current = incr(this.current, this.stack.length);
	// var p2 = incr(p1, this.stack.length);
	// change the oldest
	if (this.end_of_stack)
	    this.oldest = this.current;
	else if (this.oldest == this.current)
	    this.oldest = incr(this.oldest, this.stack.length);
	this.stack[this.current] = { undo: undo_fn, redo: redo_fn };
	this.newest = this.current;

	// top of the stack
	this.top_of_stack = true;
	this.end_of_stack = false;
    }
    function undo() {
	// check that we haven't reached the end
	if (this.end_of_stack) return console.warn('End of stack.');
	// run the lastest stack function
	this.stack[this.current].undo();
	if (this.current == this.oldest) {
	    // if the next index is less than the oldest, then the stack is dead
	    this.end_of_stack = true;
	} else {
	    // reference the next fn
	    this.current = decr(this.current, this.stack.length);
	}

	// not at the top of the stack
	this.top_of_stack = false;
    }
    function redo() {
	// check that we haven't reached the end
	if (this.top_of_stack) return console.warn('Top of stack.');

	if (!this.end_of_stack)
	    this.current = incr(this.current, this.stack.length);
	this.stack[this.current].redo();

	// if at top of stack
	if (this.current == this.newest)
	    this.top_of_stack = true;

	// not at the end of the stack
	this.end_of_stack = false;
    }
    function incr(a, l) {
	return a + 1 > l - 1 ? 0 : a + 1;
    }
    function decr(a, l) {
	return a - 1 < 0 ? l - 1 : a -  1;
    }
});

define('CallbackManager',["utils"], function(utils) {
    /** CallbackManager()

     */

    var CallbackManager = utils.make_class();
    CallbackManager.prototype = { init: init,
				  set: set,
				  remove: remove,
				  run: run };

    return CallbackManager;

    function init() {

    }
    function set(name, fn) {
	/** As in d3 callbacks, you can namespace your callbacks after a period:
	 
	 select_metabolite.direction_arrow
	 select_metabolite.input

	 Both are called by select_metabolite
	 
	 */
	if (this.callbacks===undefined) this.callbacks = {};
	if (this.callbacks[name]===undefined) this.callbacks[name] = [];
	this.callbacks[name].push(fn);

	return this;
    }
    function remove(name) {
	/** Remove a callback by name
	 
	 */
	if (this.callbacks===undefined || Object.keys(this.callbacks).length==0) {
	    console.warn('No callbacks to remove');
	}
	delete this.callbacks[name];
	return this;
    }
    function run(name) {
	/** Run all callbacks that match the portion of name before the period ('.').

	 */
	if (this.callbacks===undefined) return this;
	// pass all but the first (name) argument to the callback
	var pass_args = Array.prototype.slice.call(arguments, 1);
	// look for matching callback names
	for (var a_name in this.callbacks) {
	    var split_name = a_name.split('.')[0];
	    if (split_name==name) {
		this.callbacks[a_name].forEach(function(fn) {
		    fn.apply(null, pass_args);
		});
	    }
	}
	return this;
    }
});

define('KeyManager',["utils"], function(utils) {
    /** 
     */

    var KeyManager = utils.make_class();
    // static methods
    KeyManager.reset_held_keys = reset_held_keys;
    // instance methods
    KeyManager.prototype = { init: init,
			     update: update,
			     toggle: toggle,
			     add_escape_listener: add_escape_listener };

    return KeyManager;

    // static methods
    function reset_held_keys(h) {
        h.command = false;
	h.control = false;
	h.option = false;
	h.shift = false;
    }
    // instance methods
    function init(assigned_keys, reaction_input) {
	/** Assign keys for commands.

	 */

	if (assigned_keys===undefined) this.assigned_keys = {};
	else this.assigned_keys = assigned_keys;
	if (reaction_input===undefined) this.reaction_input = null;
	else this.reaction_input = reaction_input;

	this.held_keys = {};
	reset_held_keys(this.held_keys);

	this.enabled = true;

	this.update();
    }

    function update() {
	var held_keys = this.held_keys,
	    keys = this.assigned_keys,
	    self = this;

        var modifier_keys = { command: 91,
                              control: 17,
                              option: 18,
                              shift: 16 };

        d3.select(window).on("keydown.key_manager", null);
        d3.select(window).on("keyup.key_manager", null);

	if (!(this.enabled)) return;

        d3.select(window).on("keydown.key_manager", function() {
            var kc = d3.event.keyCode,
                reaction_input_visible = self.reaction_input ?
		    self.reaction_input.is_visible() : false,
		meaningless = true;
            toggle_modifiers(modifier_keys, held_keys, kc, true);
	    for (var key_id in keys) {
		var assigned_key = keys[key_id];
		if (check_key(assigned_key, kc, held_keys)) {
		    meaningless = false;
		    if (!(assigned_key.ignore_with_input && reaction_input_visible)) {
			if (assigned_key.fn) {
			    assigned_key.fn.call(assigned_key.target);
			} else {
			    console.warn('No function for key');
			}
			// prevent browser action
			d3.event.preventDefault();
		    }
		}
	    }
	    // Sometimes modifiers get 'stuck', so reset them once in a while.
	    // Only do this when a meaningless key is pressed
	    for (var k in modifier_keys)
		if (modifier_keys[k] == kc) meaningless = false;
	    if (meaningless) 
		reset_held_keys(held_keys);
        }).on("keyup.key_manager", function() {
            toggle_modifiers(modifier_keys, held_keys,
			     d3.event.keyCode, false);
        });
        function toggle_modifiers(mod, held, kc, on_off) {
            for (var k in mod)
                if (mod[k] == kc)
                    held[k] = on_off;
        }
        function check_key(key, pressed, held) {
            if (key.key != pressed) return false;
            var mod = key.modifiers;
            if (mod === undefined)
                mod = { control: false,
                        command: false,
                        option: false,
                        shift: false };
            for (var k in held) {
                if (mod[k] === undefined) mod[k] = false;
                if (mod[k] != held[k]) return false;
            }
            return true;
        }
    }
    function toggle(on_off) {
	/** Turn the brush on or off

	 */
	if (on_off===undefined) on_off = !this.enabled;

	this.update();
    }	
    function add_escape_listener(callback) {
	/** Call the callback when the escape key is pressed, then
	 unregisters the listener.

	 */
	var selection = d3.select(window);
	selection.on('keydown.esc', function() {
	    if (d3.event.keyCode==27) { // esc
		callback();
		selection.on('keydown.esc', null);
	    }
	});
	return { clear: function() { selection.on('keydown.esc', null); } };
    }
});

define('Canvas',["utils", "CallbackManager"], function(utils, CallbackManager) {
    /** Defines a canvas that accepts drag/zoom events and can be resized.

     Canvas(selection, x, y, width, height)

     Adapted from http://bl.ocks.org/mccannf/1629464.

     */

    var Canvas = utils.make_class();
    Canvas.prototype = { init: init,
			 toggle_resize: toggle_resize,
			 setup: setup,
			 size_and_location: size_and_location };

    return Canvas;

    function init(selection, size_and_location) {
	this.selection = selection;
	this.x = size_and_location.x;
	this.y = size_and_location.y;
	this.width = size_and_location.width;
	this.height = size_and_location.height;

	// enable by default
	this.resize_enabled = true;

	// set up the callbacks
	this.callback_manager = new CallbackManager();

	this.setup();
    }

    function toggle_resize(on_off) {
	/** Turn the resize on or off

	 */
	if (on_off===undefined) on_off = !this.resize_enabled;

	if (on_off) {
	    this.selection.selectAll('.drag-rect')
		.style('pointer-events', 'auto');
	} else {
	    this.selection.selectAll('.drag-rect')
		.style('pointer-events', 'none');
	}
    }	

    function setup() {	
	var self = this,
	    extent = {"x": this.width, "y": this.height},
	    dragbar_width = 20,
	    new_sel = this.selection.append('g')
		.classed('canvas-group', true)
		.data([{x: this.x, y: this.y}]);
	
	var rect = new_sel.append('rect')
		.attr('id', 'mouse-node')
		.attr("width", this.width)
		.attr("height", this.height)
		.attr("transform", "translate("+[self.x, self.y]+")")
		.attr('class', 'canvas')
		.attr('pointer-events', 'all');

	var drag_right = d3.behavior.drag()
		.origin(Object)
		.on("dragstart", stop_propagation)
		.on("drag", rdragresize),
	    drag_left = d3.behavior.drag()
		.origin(Object)
		.on("dragstart", stop_propagation)
		.on("drag", ldragresize),
	    drag_top = d3.behavior.drag()
		.origin(Object)
		.on("dragstart", stop_propagation)
		.on("drag", tdragresize),
	    drag_bottom = d3.behavior.drag()
		.origin(Object)
		.on("dragstart", stop_propagation)
		.on("drag", bdragresize);

	var left = new_sel.append("rect")
		.classed('drag-rect', true)
		.attr('transform', function(d) {
		    return 'translate('+[ d.x - (dragbar_width/2),
					  d.y + (dragbar_width/2) ]+')';
		})
		.attr("height", this.height - dragbar_width)
		.attr("id", "dragleft")
		.attr("width", dragbar_width)
		.attr("cursor", "ew-resize")
		.classed('resize-rect', true)
		.call(drag_left);
	
	var right = new_sel.append("rect")
		.classed('drag-rect', true)
		.attr('transform', function(d) {
		    return 'translate('+[ d.x + self.width - (dragbar_width/2),
					  d.y + (dragbar_width/2) ]+')';
		})
		.attr("id", "dragright")
		.attr("height", this.height - dragbar_width)
		.attr("width", dragbar_width)
		.attr("cursor", "ew-resize")
		.classed('resize-rect', true)
		.call(drag_right);
	
	var top = new_sel.append("rect")
		.classed('drag-rect', true)
		.attr('transform', function(d) {
		    return 'translate('+[ d.x + (dragbar_width/2),
					  d.y - (dragbar_width/2) ]+')';
		})
		.attr("height", dragbar_width)
		.attr("id", "dragtop")
		.attr("width", this.width - dragbar_width)
		.attr("cursor", "ns-resize")
		.classed('resize-rect', true)
		.call(drag_top);
	
	var bottom = new_sel.append("rect")
		.classed('drag-rect', true)
		.attr('transform', function(d) {
		    return 'translate('+[ d.x + (dragbar_width/2),
					  d.y + self.height - (dragbar_width/2) ]+')';
		})
		.attr("id", "dragbottom")
		.attr("height", dragbar_width)
		.attr("width", this.width - dragbar_width)
		.attr("cursor", "ns-resize")
		.classed('resize-rect', true)
		.call(drag_bottom);
	
	// definitions
	function stop_propagation() {
	    d3.event.sourceEvent.stopPropagation();
	}
	function transform_string(x, y, current_transform) {
	    var tr = d3.transform(current_transform),
		translate = tr.translate;	    
	    if (x!==null) translate[0] = x;
	    if (y!==null) translate[1] = y;
	    return 'translate('+translate+')';
	}
	function ldragresize(d) {
	    var oldx = d.x; 
	    d.x = Math.min(d.x + self.width - (dragbar_width / 2), d3.event.x);
	    self.x = d.x;
	    self.width = self.width + (oldx - d.x);
	    left.attr("transform", function(d) {
		return transform_string(d.x - (dragbar_width / 2), null, left.attr('transform'));
	    });
	    rect.attr("transform", function(d) {
		return transform_string(d.x, null, rect.attr('transform'));
	    }).attr("width", self.width);
	    top.attr("transform", function(d) {
		return transform_string(d.x + (dragbar_width/2), null, top.attr('transform'));
	    }).attr("width", self.width - dragbar_width);
	    bottom.attr("transform", function(d) {
		return transform_string(d.x + (dragbar_width/2), null, bottom.attr('transform'));
	    }).attr("width", self.width - dragbar_width);

	    self.callback_manager.run('resize');
	}

	function rdragresize(d) {
	    d3.event.sourceEvent.stopPropagation();
	    var dragx = Math.max(d.x + (dragbar_width/2), d.x + self.width + d3.event.dx);
	    //recalculate width
	    self.width = dragx - d.x;
	    //move the right drag handle
	    right.attr("transform", function(d) {
		return transform_string(dragx - (dragbar_width/2), null, right.attr('transform'));
	    });
	    //resize the drag rectangle
	    //as we are only resizing from the right, the x coordinate does not need to change
	    rect.attr("width", self.width);
	    top.attr("width", self.width - dragbar_width);
	    bottom.attr("width", self.width - dragbar_width);

	    self.callback_manager.run('resize');
	}

	function tdragresize(d) {
	    d3.event.sourceEvent.stopPropagation();	    
	    var oldy = d.y; 
	    d.y = Math.min(d.y + self.height - (dragbar_width / 2), d3.event.y);
	    self.y = d.y;
	    self.height = self.height + (oldy - d.y);
	    top.attr("transform", function(d) {
		return transform_string(null, d.y - (dragbar_width / 2), top.attr('transform'));
	    });
	    rect.attr("transform", function(d) {
		return transform_string(null, d.y, rect.attr('transform'));
	    }).attr("height", self.height);
	    left.attr("transform", function(d) {
		return transform_string(null, d.y + (dragbar_width/2), left.attr('transform'));
	    }).attr("height", self.height - dragbar_width);
	    right.attr("transform", function(d) {
		return transform_string(null, d.y + (dragbar_width/2), right.attr('transform'));
	    }).attr("height", self.height - dragbar_width);

	    self.callback_manager.run('resize');
	}

	function bdragresize(d) {
	    d3.event.sourceEvent.stopPropagation();
	    var dragy = Math.max(d.y + (dragbar_width/2), d.y + self.height + d3.event.dy);
	    //recalculate width
	    self.height = dragy - d.y;
	    //move the right drag handle
	    bottom.attr("transform", function(d) {
		return transform_string(null, dragy - (dragbar_width/2), bottom.attr('transform'));
	    });
	    //resize the drag rectangle
	    //as we are only resizing from the right, the x coordinate does not need to change
	    rect.attr("height", self.height);
	    left.attr("height", self.height - dragbar_width);
	    right.attr("height", self.height - dragbar_width);

	    self.callback_manager.run('resize');
	}
    }

    function size_and_location() {
	return { x: this.x,
		 y: this.y,
		 width: this.width,
		 height: this.height };
    }
});

define('Map',["utils", "draw", "Behavior", "Scale", "DirectionArrow", "build", "UndoStack", "CallbackManager", "KeyManager", "Canvas", "data_styles"], function(utils, draw, Behavior, Scale, DirectionArrow, build, UndoStack, CallbackManager, KeyManager, Canvas, data_styles) {
    /** Defines the metabolic map data, and manages drawing and building.

     Arguments
     ---------
     selection: A d3 selection for a node to place the map inside. Should be an SVG element.
     behavior: A Behavior object which defines the interactivity of the map.

     */

    var Map = utils.make_class();
    // static methods
    Map.from_data = from_data;
    // instance methods
    Map.prototype = {
	// setup
	init: init,
	setup_containers: setup_containers,
	reset_containers: reset_containers,
	// appearance
	set_status: set_status,
	set_model: set_model,
	set_reaction_data: set_reaction_data,
	set_metabolite_data: set_metabolite_data,
	clear_map: clear_map,
	// selection
	select_metabolite: select_metabolite,
	select_metabolite_with_id: select_metabolite_with_id,
	select_single_node: select_single_node,
	deselect_nodes: deselect_nodes,
	select_text_label: select_text_label,
	deselect_text_labels: deselect_text_labels,
	// build
	new_reaction_from_scratch: new_reaction_from_scratch,
	new_reaction_for_metabolite: new_reaction_for_metabolite,
	cycle_primary_node: cycle_primary_node,
	make_selected_node_primary: make_selected_node_primary,
	rotate_selected_nodes: rotate_selected_nodes,
	// delete
	delete_selected: delete_selected,
	delete_nodes: delete_nodes,
	delete_text_labels: delete_text_labels,
	delete_node_data: delete_node_data,
	delete_segment_data: delete_segment_data,
	delete_reaction_data: delete_reaction_data,
	delete_text_label_data: delete_text_label_data,
	// find
	get_selected_node_ids: get_selected_node_ids,
	get_selected_nodes: get_selected_nodes,
	get_selected_text_label_ids: get_selected_text_label_ids,
	get_selected_text_labels: get_selected_text_labels,
	segments_and_reactions_for_nodes: segments_and_reactions_for_nodes,
	// draw
	has_reaction_data: has_reaction_data,
	has_metabolite_data: has_metabolite_data,
	draw_everything: draw_everything,
	draw_all_reactions: draw_all_reactions,
	draw_these_reactions: draw_these_reactions,
	draw_all_nodes: draw_all_nodes,
	draw_these_nodes: draw_these_nodes,
	draw_these_text_labels: draw_these_text_labels,
	apply_reaction_data_to_map: apply_reaction_data_to_map,
	apply_reaction_data_to_reactions: apply_reaction_data_to_reactions,
	update_reaction_data_domain: update_reaction_data_domain,
	apply_metabolite_data_to_map: apply_metabolite_data_to_map,
	apply_metabolite_data_to_nodes: apply_metabolite_data_to_nodes,
	update_metabolite_data_domain: update_metabolite_data_domain,
	get_selected_node_ids: get_selected_node_ids,
	toggle_beziers: toggle_beziers,
	hide_beziers: hide_beziers,
	show_beziers: show_beziers,
	zoom_extent_nodes: zoom_extent_nodes,
	zoom_extent_canvas: zoom_extent_canvas,
	_zoom_extent: _zoom_extent,
	get_size: get_size,
	// io
	save: save,
	map_for_export: map_for_export,
	save_svg: save_svg
    };

    return Map;

    function init(svg, css, selection, zoom_container, reaction_data,
		  reaction_data_styles, metabolite_data, metabolite_data_styles,
		  cobra_model, canvas_size_and_loc) {
	if (canvas_size_and_loc===undefined || canvas_size_and_loc===null) {
	    var size = zoom_container.get_size();
	    canvas_size_and_loc = {x: -size.width, y: -size.height,
				   width: size.width*3, height: size.height*3};
	}

	// defaults
	var default_angle = 90; // degrees
	this.default_reaction_color = '#334E75',

	// set up the defs
	this.svg = svg;
	this.defs = utils.setup_defs(svg, css);

	// make the canvas
	this.canvas = new Canvas(selection, canvas_size_and_loc);

	this.setup_containers(selection);
	this.sel = selection;
	this.zoom_container = zoom_container;

	// check and load data
	this.reaction_data_object = data_styles.import_and_check(reaction_data,
								 reaction_data_styles,
								 'reaction_data');
	this.reaction_data_styles = reaction_data_styles;
	this.metabolite_data_object = data_styles.import_and_check(metabolite_data,
								   metabolite_data_styles,
								   'metabolite_data');
	this.metabolite_data_styles = metabolite_data_styles;

	// set the model AFTER loading the datasets
	this.set_model(cobra_model);

	this.largest_ids = { reactions: -1,
			     nodes: -1,
			     segments: -1 };

	// make the scales
	this.scale = new Scale();

	// make the undo/redo stack
	this.undo_stack = new UndoStack();

	// make a behavior object
	this.behavior = new Behavior(this, this.undo_stack);

	// make a key manager
	this.key_manager = new KeyManager();

	// deal with the window
	var window_translate = {'x': 0, 'y': 0},
	    window_scale = 1;

	// hide beziers
	this.beziers_enabled = false;

	// set up the callbacks
	this.callback_manager = new CallbackManager();
	
	// set up the reaction direction arrow
	var direction_arrow = new DirectionArrow(selection);
	direction_arrow.set_rotation(default_angle);
	this.callback_manager.set('select_metabolite_with_id', function(_, coords) {
	    direction_arrow.set_location(coords);
	    direction_arrow.show();
	});
	this.callback_manager.set('select_metabolite', function(count, _, coords) {
	    if (count == 1) {
		direction_arrow.set_location(coords);
		direction_arrow.show();
	    } else {
		direction_arrow.hide();
	    }
	});
	this.callback_manager.set('before_svg_export', function() {
	    direction_arrow.hide();
	});
	this.direction_arrow = direction_arrow;

	this.nodes = {};
	this.reactions = {};
	this.membranes = [];
	this.text_labels = {};
	this.info = {};

	// performs some extra checks
	this.debug = false;
    };

    // -------------------------------------------------------------------------
    // Import

    function from_data(map_data, svg, css, selection, zoom_container,
		       reaction_data, reaction_data_styles,
		       metabolite_data, metabolite_data_styles, cobra_model) {
	/** Load a json map and add necessary fields for rendering.
	 
	 */
	utils.check_undefined(arguments, ['map_data', 'svg', 'css', 'selection',
					  'zoom_container',
					  'reaction_data', 'reaction_data_styles',
					  'metabolite_data', 'metabolite_data_styles',
					  'cobra_model']);

	if (this.debug) {
	    d3.json('map_spec.json', function(error, spec) {
		if (error) {
		    console.warn(error);
		    return;
		}
		utils.check_r(map_data, spec.spec, spec.can_be_none);
	    });
	}
	
	var canvas = map_data.canvas,
	    map = new Map(svg, css, selection, zoom_container,
			  reaction_data, reaction_data_styles, metabolite_data,
			  metabolite_data_styles, cobra_model, canvas);

	map.reactions = map_data.reactions;
	map.nodes = map_data.nodes;
	map.membranes = map_data.membranes;
	map.text_labels = map_data.text_labels;
	map.info = map_data.info;

	// propogate coefficients and reversbility
	for (var r_id in map.reactions) {
	    var reaction = map.reactions[r_id];
	    for (var s_id in reaction.segments) {
		var segment = reaction.segments[s_id];
		segment.reversibility = reaction.reversibility;
		var from_node_bigg_id = map.nodes[segment.from_node_id].bigg_id;
		if (from_node_bigg_id in reaction.metabolites) {
		    segment.from_node_coefficient = reaction.metabolites[from_node_bigg_id].coefficient;
		}
		var to_node_bigg_id = map.nodes[segment.to_node_id].bigg_id;
		if (to_node_bigg_id in reaction.metabolites) {
		    segment.to_node_coefficient = reaction.metabolites[to_node_bigg_id].coefficient;
		}
		// if metabolite without beziers, then add them
		var start = map.nodes[segment.from_node_id],
		    end = map.nodes[segment.to_node_id];
		if (start['node_type']=='metabolite' || end['node_type']=='metabolite') {
		    var midpoint = utils.c_plus_c(start, utils.c_times_scalar(utils.c_minus_c(end, start), 0.5));
		    if (segment.b1 === null) segment.b1 = midpoint;
		    if (segment.b2 === null) segment.b2 = midpoint;
		}

	    }
	}

	// get largest ids for adding new reactions, nodes, text labels, and
	// segments
	map.largest_ids.reactions = get_largest_id(map.reactions);
	map.largest_ids.nodes = get_largest_id(map.nodes);
	map.largest_ids.text_labels = get_largest_id(map.text_labels);

	var largest_segment_id = 0;
	for (var id in map.reactions) {
	    largest_segment_id = get_largest_id(map.reactions[id].segments,
						largest_segment_id);
	}
	map.largest_ids.segments = largest_segment_id;

	// reaction_data onto existing map reactions
	map.apply_reaction_data_to_map();
	map.apply_metabolite_data_to_map();

	return map;

	// definitions
	function get_largest_id(obj, current_largest) {
	    /** Return the largest integer key in obj, or current_largest, whichever is bigger. */
	    if (current_largest===undefined) current_largest = 0;
	    if (obj===undefined) return current_largest;
	    return Math.max.apply(null, Object.keys(obj).map(function(x) {
		return parseInt(x);
	    }).concat([current_largest]));
	}
    }

    // ---------------------------------------------------------------------
    // Drawing

    function setup_containers(sel) {
        sel.append('g')
	    .attr('id', 'membranes');
        sel.append('g')
	    .attr('id', 'reactions');
        sel.append('g')
	    .attr('id', 'nodes');
        sel.append('g')
	    .attr('id', 'text-labels');
    }
    function reset_containers() {
	this.sel.select('#membranes')
	    .selectAll('.membrane')
	    .remove();
	this.sel.select('#reactions')
	    .selectAll('.reaction')
	    .remove();
	this.sel.select('#nodes')
	    .selectAll('.node')
	    .remove();
	this.sel.select('#text-labels')
	    .selectAll('.text-label')
	    .remove();
    }

    // -------------------------------------------------------------------------
    // Appearance

    function set_status(status) {
	this.status = status;
	this.callback_manager.run('set_status', status);
    }
    function set_model(model) {
	/** Change the cobra model for the map.

	 */
	this.cobra_model = model;
	if (this.cobra_model !== null) {
	    this.cobra_model.apply_reaction_data(this.reaction_data_object,
						 this.reaction_data_styles);
	    this.cobra_model.apply_metabolite_data(this.metabolite_data_object,
						   this.metabolite_data_styles);
	}
    }
    function set_reaction_data(reaction_data) {
	/** Set a new reaction data, and redraw the map.

	 Pass null to reset the map and draw without reaction data.

	 */
	this.reaction_data_object = data_styles.import_and_check(reaction_data,
								 this.reaction_data_styles,
								 'reaction_data');
	this.apply_reaction_data_to_map();
	if (this.cobra_model !== null) {
	    this.cobra_model.apply_reaction_data(this.reaction_data_object,
						 this.reaction_data_styles);
	}
	this.draw_all_reactions();
    }
    function set_metabolite_data(metabolite_data) {
	/** Set a new metabolite data, and redraw the map.

	 Pass null to reset the map and draw without metabolite data.

	 */
	this.metabolite_data_object = data_styles.import_and_check(metabolite_data,
								   this.metabolite_data_styles,
								   'metabolite_data');
	this.apply_metabolite_data_to_map();
	if (this.cobra_model !== null) {
	    this.cobra_model.apply_metabolite_data(this.metabolite_data_object,
						   this.metabolite_data_styles);
	}
	this.draw_all_nodes();
    }
    function clear_map() {
	this.reactions = {};
	this.nodes = {};
	this.membranes = [];
	this.text_labels = {};
	// reaction_data onto existing map reactions
	this.apply_reaction_data_to_map();
	this.apply_metabolite_data_to_map();
	this.draw_everything();
    }
    function has_reaction_data() {
	return (this.reaction_data_object!==null);
    }
    function has_metabolite_data() {
	return (this.metabolite_data_object!==null);
    }
    function draw_everything() {
        /** Draw the reactions and membranes

         */
	var sel = this.sel,
	    membranes = this.membranes,
	    scale = this.scale,
	    reactions = this.reactions,
	    nodes = this.nodes,
	    text_labels = this.text_labels,
	    defs = this.defs,
	    default_reaction_color = this.default_reaction_color,
	    bezier_drag_behavior = this.behavior.bezier_drag,
	    node_click_fn = this.behavior.node_click,
	    node_drag_behavior = this.behavior.node_drag,
	    reaction_label_drag = this.behavior.reaction_label_drag,
	    node_label_drag = this.behavior.node_label_drag,
	    text_label_click = this.behavior.text_label_click,
	    text_label_drag = this.behavior.text_label_drag,
	    has_reaction_data = this.has_reaction_data(),
	    reaction_data_styles = this.reaction_data_styles,
	    has_metabolite_data = this.has_metabolite_data(),
	    metabolite_data_styles = this.metabolite_data_styles,
	    beziers_enabled = this.beziers_enabled;

	utils.draw_an_array(sel, '#membranes' ,'.membrane', membranes,
			    draw.create_membrane,
			    draw.update_membrane);

	utils.draw_an_object(sel, '#reactions', '.reaction', reactions,
			     'reaction_id',
			     draw.create_reaction, 
			     function(sel) { return draw.update_reaction(sel,
									 scale, 
									 nodes,
									 beziers_enabled, 
									 defs,
									 default_reaction_color,
									 has_reaction_data,
									 reaction_data_styles,
									 bezier_drag_behavior,
									 reaction_label_drag); });

	utils.draw_an_object(sel, '#nodes', '.node', nodes, 'node_id', 
			     function(sel) { return draw.create_node(sel, nodes, reactions); },
			     function(sel) { return draw.update_node(sel, scale,
								     has_metabolite_data,
								     metabolite_data_styles,
								     node_click_fn,
								     node_drag_behavior,
								     node_label_drag); });

	utils.draw_an_object(sel, '#text-labels', '.text-label', text_labels,
			     'text_label_id',
			     function(sel) { return draw.create_text_label(sel); }, 
			     function(sel) { return draw.update_text_label(sel,
									   text_label_click,
									   text_label_drag); });


    }
    function draw_all_reactions() {
	var reaction_ids = [];
	for (var reaction_id in this.reactions) {
	    reaction_ids.push(reaction_id);
	}
	this.draw_these_reactions(reaction_ids);
    }
    function draw_these_reactions(reaction_ids) {
	var scale = this.scale,
	    reactions = this.reactions,
	    nodes = this.nodes,
	    defs = this.defs,
	    default_reaction_color = this.default_reaction_color,
	    bezier_drag_behavior = this.behavior.bezier_drag,
	    reaction_label_drag = this.behavior.reaction_label_drag,
	    has_reaction_data = this.has_reaction_data(),
	    reaction_data_styles = this.reaction_data_styles,
	    beziers_enabled = this.beziers_enabled;

        // find reactions for reaction_ids
        var reaction_subset = {},
	    i = -1;
        while (++i<reaction_ids.length) {
	    reaction_subset[reaction_ids[i]] = utils.clone(reactions[reaction_ids[i]]);
        }
        if (reaction_ids.length != Object.keys(reaction_subset).length) {
	    console.warn('did not find correct reaction subset');
        }

        // generate reactions for o.drawn_reactions
        // assure constancy with cobra_id
        var sel = this.sel.select('#reactions')
                .selectAll('.reaction')
                .data(utils.make_array(reaction_subset, 'reaction_id'),
		      function(d) { return d.reaction_id; });

        // enter: generate and place reaction
        sel.enter().call(draw.create_reaction);

        // update: update when necessary
        sel.call(function(sel) { return draw.update_reaction(sel, scale, 
							     nodes,
							     beziers_enabled, 
							     defs,
							     default_reaction_color,
							     has_reaction_data,
							     reaction_data_styles,
							     bezier_drag_behavior,
							     reaction_label_drag); });

        // exit
        sel.exit();
    }
    function draw_all_nodes() {
	var node_ids = [];
	for (var node_id in this.nodes) {
	    node_ids.push(node_id);
	}
	this.draw_these_nodes(node_ids);
    }
    function draw_these_nodes(node_ids) {
	var scale = this.scale,
	    reactions = this.reactions,
	    nodes = this.nodes,
	    node_click_fn = this.behavior.node_click,
	    node_drag_behavior = this.behavior.node_drag,
	    node_label_drag = this.behavior.node_label_drag,
	    metabolite_data_styles = this.metabolite_data_styles,
	    has_metabolite_data = this.has_metabolite_data();

	// find nodes for node_ids
        var node_subset = {},
	    i = -1;
        while (++i<node_ids.length) {
	    node_subset[node_ids[i]] = utils.clone(nodes[node_ids[i]]);
        }
        if (node_ids.length != Object.keys(node_subset).length) {
	    console.warn('did not find correct node subset');
        }

        // generate nodes for o.drawn_nodes
        // assure constancy with cobra_id
        var sel = this.sel.select('#nodes')
                .selectAll('.node')
                .data(utils.make_array(node_subset, 'node_id'),
		      function(d) { return d.node_id; });

        // enter: generate and place node
        sel.enter().call(function(sel) { return draw.create_node(sel, nodes, reactions); });

        // update: update when necessary
        sel.call(function(sel) { return draw.update_node(sel, scale, has_metabolite_data, metabolite_data_styles, 
							 node_click_fn, node_drag_behavior,
							 node_label_drag); });

        // exit
        sel.exit();
    }
    function draw_these_text_labels(text_label_ids) {
	var text_labels = this.text_labels,
	    text_label_click = this.behavior.text_label_click,
	    text_label_drag = this.behavior.text_label_drag;

	// find text labels for text_label_ids
        var text_label_subset = {},
	    i = -1;
        while (++i<text_label_ids.length) {
	    text_label_subset[text_label_ids[i]] = utils.clone(text_labels[text_label_ids[i]]);
        }
        if (text_label_ids.length != Object.keys(text_label_subset).length) {
	    console.warn('did not find correct text label subset');
        }

        // generate text for this.text_labels
        var sel = this.sel.select('#text-labels')
                .selectAll('.text-label')
                .data(utils.make_array(text_label_subset, 'text_label_id'),
		      function(d) { return d.text_label_id; });

        // enter: generate and place label
        sel.enter().call(function(sel) {
	    return draw.create_text_label(sel);
	});

        // update: update when necessary
        sel.call(function(sel) {
	    return draw.update_text_label(sel, text_label_click, text_label_drag);
	});

        // exit
        sel.exit();
    }
    function apply_reaction_data_to_map() {
	/**  Returns True if the scale has changed.

	 */
	return this.apply_reaction_data_to_reactions(this.reactions);
    }
    function apply_reaction_data_to_reactions(reactions) {
	/**  Returns True if the scale has changed.

	 */
	if (!this.has_reaction_data()) {
	    for (var reaction_id in reactions) {
	    var reaction = reactions[reaction_id];
		reaction.data = null;
		reaction.data_string = '';
		for (var segment_id in reaction.segments) {
		    var segment = reaction.segments[segment_id];
		    segment.data = null;
		}
	    }
	    return false;
	}
	// grab the data
	var data = this.reaction_data_object,
	    styles = this.reaction_data_styles;
	// apply the datasets to the reactions	
	for (var reaction_id in reactions) {
	    var reaction = reactions[reaction_id],
		d = (reaction.bigg_id in data ? data[reaction.bigg_id] : null),
		f = data_styles.float_for_data(d, styles),
		s = data_styles.text_for_data(d, styles);
	    reaction.data = f;
	    reaction.data_string = s;
	    // apply to the segments
	    for (var segment_id in reaction.segments) {
		var segment = reaction.segments[segment_id];
		segment.data = f;
	    }
	}
	return this.update_reaction_data_domain();
    }
    function update_reaction_data_domain() {
	/**  Returns True if the scale has changed.

	 */
	// default min and max
	var vals = [];
	for (var reaction_id in this.reactions) {
	    var reaction = this.reactions[reaction_id];
	    if (reaction.data!==null) {
		vals.push(reaction.data);
	    }
	}
	
	var old_domain = this.scale.reaction_color.domain(),
	    new_domain, new_color_range, new_size_range;
	    
	if (this.reaction_data_styles.indexOf('Abs') != -1) {
	    var min = 0, max = 0;
	    if (vals.length > 0) {
		vals = vals.map(function(x) { return Math.abs(x); });
		min = Math.min.apply(null, vals),
		max = Math.max.apply(null, vals);
	    } 
	    if (max==0) max = min = 10;
	    if (min==max) min = max/2;
	    new_domain = [-max, -min, 0, min, max];
	    new_color_range = ["red", "blue", "rgb(200,200,200)", "blue", "red"];
	    new_size_range = [12, 6, 6, 6, 12];
	} else {
	    var min = 0, max = 0;
	    vals.push(0);
	    if (vals.length > 0) {
		min = Math.min.apply(null, vals),
		max = Math.max.apply(null, vals);
	    }
	    new_domain = [min, max];
	    new_color_range = ["blue", "red"];
	    new_size_range = [6, 12];
	}
	this.scale.reaction_color.domain(new_domain).range(new_color_range);
	this.scale.reaction_size.domain(new_domain).range(new_size_range);
	// run the callback
	this.callback_manager.run('update_reaction_data_domain');
	// compare arrays
	return !utils.compare_arrays(old_domain, new_domain);
    }
    function apply_metabolite_data_to_map() {
	/**  Returns True if the scale has changed.

	 */
	return this.apply_metabolite_data_to_nodes(this.nodes);
    }
    function apply_metabolite_data_to_nodes(nodes) {
	/**  Returns True if the scale has changed.

	 */
	if (!this.has_metabolite_data()) {
	    for (var node_id in nodes) {
		nodes[node_id].data = null;
		nodes[node_id].data_string = '';
	    }
	    return false;
	}
	// grab the data
	var data = this.metabolite_data_object,
	    styles = this.metabolite_data_styles;
	for (var node_id in nodes) {
	    var node = nodes[node_id],
		d = (node.bigg_id in data ? data[node.bigg_id] : null),
		f = data_styles.float_for_data(d, styles),
		s = data_styles.text_for_data(d, styles);
	    node.data = f;
	    node.data_string = s;
	}
	return this.update_metabolite_data_domain();
    }
    function update_metabolite_data_domain() {
	/**  Returns True if the scale has changed.

	 */
	// default min and max
	var min = 0, max = 0, vals = [];
	for (var node_id in this.nodes) {
	    var node = this.nodes[node_id];
	    if (node.data!==null)
		vals.push(node.data);
	}
	if (vals.length > 0) {
	    min = Math.min.apply(null, vals),
	    max = Math.max.apply(null, vals);
	} 
	var old_domain = this.scale.metabolite_size.domain(),
	    new_domain, new_color_range, new_size_range;

	if (this.metabolite_data_styles.indexOf('Abs') != -1) {
	    var min = 0, max = 0;
	    if (vals.length > 0) {
		vals = vals.map(function(x) { return Math.abs(x); });
		min = Math.min.apply(null, vals),
		max = Math.max.apply(null, vals);
	    } 
	    if (max==0) max = min = 10;
	    if (min==max) min = max/2;
	    new_domain = [-max, -min, 0, min, max];
	    new_color_range = ["red", "white", "white", "white", "red"];
	    new_size_range = [15, 8, 8, 8, 18];
	} else {
	    var min = 0, max = 0;
	    vals.push(0);
	    if (vals.length > 0) {
		min = Math.min.apply(null, vals),
		max = Math.max.apply(null, vals);
	    }
	    new_domain = [min, max];
	    new_color_range = ["white", "red"];
	    new_size_range = [8, 15];
	}
	this.scale.metabolite_color.domain(new_domain).range(new_color_range);
	this.scale.metabolite_size.domain(new_domain).range(new_size_range);
	// run the callback
	this.callback_manager.run('update_metabolite_data_domain');
	// compare arrays
	return !utils.compare_arrays(old_domain, new_domain);
    }

    // ---------------------------------------------------------------------
    // Node interaction
    
    function get_coords_for_node(node_id) {
        var node = this.nodes[node_id],
	    coords = {'x': node.x, 'y': node.y};
        return coords;
    }
    function get_selected_node_ids() {
	var selected_node_ids = [];
	this.sel.select('#nodes')
	    .selectAll('.selected')
	    .each(function(d) { selected_node_ids.push(d.node_id); });
	return selected_node_ids;
    }
    function get_selected_nodes() {
	var selected_nodes = {},
	    self = this;
	this.sel.select('#nodes')
	    .selectAll('.selected')
	    .each(function(d) { selected_nodes[d.node_id] = self.nodes[d.node_id]; });
	return selected_nodes;
    }	
    function get_selected_text_label_ids() {
	var selected_text_label_ids = [];
	this.sel.select('#text-labels')
	    .selectAll('.selected')
	    .each(function(d) { selected_text_label_ids.push(d.text_label_id); });
	return selected_text_label_ids;
    }	
    function get_selected_text_labels() {
	var selected_text_labels = {},
	    self = this;
	this.sel.select('#text-labels')
	    .selectAll('.selected')
	    .each(function(d) { selected_text_labels[d.text_label_id] = self.text_labels[d.text_label_id]; });
	return selected_text_labels;
    }	
    function select_metabolite_with_id(node_id) {
	// deselect all text labels
	this.deselect_text_labels();

	var node_selection = this.sel.select('#nodes').selectAll('.node'),
	    coords,
	    selected_node;
	node_selection.classed("selected", function(d) {
	    var selected = String(d.node_id) == String(node_id);
	    if (selected) {
		selected_node = d;
		coords = { x: d.x, y: d.y };
	    }
	    return selected;
	});
	this.sel.selectAll('.start-reaction-target').style('visibility', 'hidden');
	this.callback_manager.run('select_metabolite_with_id', selected_node, coords);
    }
    function select_metabolite(sel, d) {
	// deselect all text labels
	this.deselect_text_labels();
	
	var node_selection = this.sel.select('#nodes').selectAll('.node'), 
	    shift_key_on = this.key_manager.held_keys.shift;
	if (shift_key_on) {
	    this.sel.select(sel.parentNode)
		.classed("selected", !this.sel.select(sel.parentNode).classed("selected"));
	}
        else node_selection.classed("selected", function(p) { return d === p; });
	var selected_nodes = this.sel.select('#nodes').selectAll('.selected'),
	    count = 0,
	    coords,
	    selected_node;
	selected_nodes.each(function(d) {
	    selected_node = d;
	    coords = { x: d.x, y: d.y };
	    count++;
	});
	this.callback_manager.run('select_metabolite', count, selected_node, coords);
    }
    function select_single_node() {
	/** Unselect all but one selected node, and return the node.

	 If no nodes are selected, return null.

	 */
	var out = null,
	    self = this,
	    node_selection = this.sel.select('#nodes').selectAll('.selected');
	node_selection.classed("selected", function(d, i) {
	    if (i==0) {
		out = d;
		return true;
	    } else {
		return false;
	    }
	});
	return out;		   
    }
    function deselect_nodes() {
	var node_selection = this.sel.select('#nodes').selectAll('.node');
	node_selection.classed("selected", false);
    }
    function select_text_label(sel, d) {
	// deselect all nodes
	this.deselect_nodes();
	// find the new selection
	// Ignore shift key and only allow single selection for now
	var text_label_selection = this.sel.select('#text-labels').selectAll('.text-label');
	text_label_selection.classed("selected", function(p) { return d === p; });
	var selected_text_labels = this.sel.select('#text-labels').selectAll('.selected'),
	    coords;
	selected_text_labels.each(function(d) {
	    coords = { x: d.x, y: d.y };
	});
	this.callback_manager.run('select_text_label');
    }
    function deselect_text_labels() {
	var text_label_selection = this.sel.select('#text-labels').selectAll('.text-label');
	text_label_selection.classed("selected", false);
    }

    // ---------------------------------------------------------------------
    // Delete

    function delete_selected() {
	/** Delete the selected nodes and associated segments and reactions, and selected labels.

	 Undoable.

	 */
	var selected_nodes = this.get_selected_nodes();
	if (Object.keys(selected_nodes).length >= 1)
	    this.delete_nodes(selected_nodes);
	
	var selected_text_labels = this.get_selected_text_labels();
	if (Object.keys(selected_text_labels).length >= 1)
	    this.delete_text_labels(selected_text_labels);
    }
    function delete_nodes(selected_nodes) {
	/** Delete the nodes and associated segments and reactions.

	 Undoable.

	 */
	var out = this.segments_and_reactions_for_nodes(selected_nodes),
	    reactions = out.reactions,
	    segment_objs_w_segments = out.segment_objs_w_segments;

	// copy nodes to undelete
	var saved_nodes = utils.clone(selected_nodes),
	    saved_segment_objs_w_segments = utils.clone(segment_objs_w_segments),
	    saved_reactions = utils.clone(reactions),
	    self = this,
	    delete_and_draw = function(nodes, reactions, segment_objs) {
		// delete nodes, segments, and reactions with no segments
  		self.delete_node_data(selected_nodes);
		self.delete_segment_data(segment_objs);
		self.delete_reaction_data(reactions);
		// redraw
		// TODO just redraw these nodes and segments
		self.draw_everything();
	    };

	// delete
	delete_and_draw(selected_nodes, reactions, segment_objs_w_segments);

	// add to undo/redo stack
	this.undo_stack.push(function() {
	    // undo
	    // redraw the saved nodes, reactions, and segments
	    utils.extend(self.nodes, saved_nodes);
	    utils.extend(self.reactions, saved_reactions);
	    var reactions_to_draw = Object.keys(saved_reactions);
	    saved_segment_objs_w_segments.forEach(function(segment_obj) {
		var segment = segment_obj.segment;
		self.reactions[segment_obj.reaction_id]
		    .segments[segment_obj.segment_id] = segment;

		// updated connected nodes
		[segment.from_node_id, segment.to_node_id].forEach(function(node_id) {
		    // not necessary for the deleted nodes
		    if (node_id in saved_nodes) return;
		    var node = self.nodes[node_id];
		    node.connected_segments.push({ reaction_id: segment_obj.reaction_id,
						   segment_id: segment_obj.segment_id });
		});

		reactions_to_draw.push(segment_obj.reaction_id);
	    });
	    self.draw_these_nodes(Object.keys(saved_nodes));
	    self.draw_these_reactions(reactions_to_draw);
	    // copy nodes to re-delete
	    selected_nodes = utils.clone(saved_nodes);
	    segment_objs_w_segments = utils.clone(saved_segment_objs_w_segments);
	    reactions = utils.clone(saved_reactions);
	}, function () {
	    // redo
	    // clone the nodes and reactions, to redo this action later
	    delete_and_draw(selected_nodes, reactions, segment_objs_w_segments);
	});
    }
    function delete_text_labels(selected_text_labels) {
	/** Delete the text_labels.

	 Undoable.

	 */
	// copy text_labels to undelete
	var saved_text_labels = utils.clone(selected_text_labels),
	    self = this,
	    delete_and_draw = function(text_labels) {
		// delete text_labels, segments, and reactions with no segments
  		self.delete_text_label_data(selected_text_labels);
		// redraw
		// TODO just redraw these text_labels
		self.draw_everything();
	    };

	// delete
	delete_and_draw(selected_text_labels);

	// add to undo/redo stack
	this.undo_stack.push(function() { // undo
	    // redraw the saved text_labels, reactions, and segments
	    utils.extend(self.text_labels, saved_text_labels);
	    self.draw_these_text_labels(Object.keys(saved_text_labels));
	    // copy text_labels to re-delete
	    selected_text_labels = utils.clone(saved_text_labels);
	}, function () { // redo
	    // clone the text_labels
	    delete_and_draw(selected_text_labels);
	});
    }
    function delete_node_data(nodes) {
	/** Simply delete nodes.
	 */
	for (var node_id in nodes) {
	    delete this.nodes[node_id];
	}
    }
    function delete_segment_data(segment_objs) {
	/** Delete segments, and update connected_segments in nodes. Also
	 deletes any reactions with 0 segments.
	 
	 segment_objs: Array of objects with { reaction_id: "123", segment_id: "456" }
	 
	 */
	var reactions = this.reactions,
	    nodes = this.nodes;
	segment_objs.forEach(function(segment_obj) {
	    var reaction = reactions[segment_obj.reaction_id];

	    // segment already deleted
	    if (!(segment_obj.segment_id in reaction.segments)) return;
	    
	    var segment = reaction.segments[segment_obj.segment_id];
	    // updated connected nodes
	    [segment.from_node_id, segment.to_node_id].forEach(function(node_id) {
		if (!(node_id in nodes)) return;
		var node = nodes[node_id];
		node.connected_segments = node.connected_segments.filter(function(so) {
		    return so.segment_id != segment_obj.segment_id;				
		});
	    });

	    delete reaction.segments[segment_obj.segment_id];
	});
    }
    function delete_reaction_data(reactions) {
	/** delete reactions
	 */
	for (var reaction_id in reactions) {
	    delete this.reactions[reaction_id];
	}
    }
    function delete_text_label_data(text_labels) {
	/** delete text labels for an array of ids
	 */
	for (var text_label_id in text_labels) {
	    delete this.text_labels[text_label_id];
	}
    }
    function show_beziers() {
	this.toggle_beziers(true);
    }
    function hide_beziers() {
	this.toggle_beziers(false);
    }
    function toggle_beziers(on_off) {
	if (on_off===undefined) this.beziers_enabled = !this.beziers_enabled;
	else this.beziers_enabled = on_off;
	this.draw_everything();
	this.callback_manager.run('toggle_beziers', this.beziers_enabled);
    }

    // ---------------------------------------------------------------------
    // Building

    function new_reaction_from_scratch(starting_reaction, coords) {
	/** Draw a reaction on a blank canvas.

	 starting_reaction: bigg_id for a reaction to draw.
	 coords: coordinates to start drawing

	 */
	
        // If reaction id is not new, then return:
	for (var reaction_id in this.reactions) {
	    if (this.reactions[reaction_id].bigg_id == starting_reaction) {             
		console.warn('reaction is already drawn');
                return null;
	    }
        }

	// If there is no cobra model, error
	if (!this.cobra_model) return console.error('No CobraModel. Cannot build new reaction');

        // set reaction coordinates and angle
        // be sure to copy the reaction recursively
        var cobra_reaction = utils.clone(this.cobra_model.reactions[starting_reaction]);

	// create the first node
	for (var metabolite_id in cobra_reaction.metabolites) {
	    var coefficient = cobra_reaction.metabolites[metabolite_id],
		metabolite = this.cobra_model.metabolites[metabolite_id];
	    if (coefficient < 0) {
		var selected_node_id = String(++this.largest_ids.nodes),
		    label_d = { x: 30, y: 10 },
		    selected_node = { connected_segments: [],
				      x: coords.x,
				      y: coords.y,
				      node_is_primary: true,
				      label_x: coords.x + label_d.x,
				      label_y: coords.y + label_d.y,
				      name: metabolite.name,
				      bigg_id: metabolite_id,
				      node_type: 'metabolite' },
		    new_nodes = {};
		new_nodes[selected_node_id] = selected_node;
		break;
	    }
	}

	// draw
	extend_and_draw_metabolite.apply(this, [new_nodes, selected_node_id]);

	// clone the nodes and reactions, to redo this action later
	var saved_nodes = utils.clone(new_nodes),
	    map = this;

	// add to undo/redo stack
	this.undo_stack.push(function() {
	    // undo
	    // get the nodes to delete
	    map.delete_node_data(new_nodes);
	    // save the nodes and reactions again, for redo
	    new_nodes = utils.clone(saved_nodes);
	    // draw
	    map.draw_everything();
	}, function () {
	    // redo
	    // clone the nodes and reactions, to redo this action later
	    extend_and_draw_metabolite.apply(map, [new_nodes, selected_node_id]);
	});
	
	// draw the reaction
	this.new_reaction_for_metabolite(starting_reaction, selected_node_id);
	
	return null;

        // definitions
	function extend_and_draw_metabolite(new_nodes, selected_node_id) {
	    utils.extend(this.nodes, new_nodes);
	    if (this.has_metabolite_data()) {
		var scale_changed = this.apply_metabolite_data_to_nodes(new_nodes);
		if (scale_changed) this.draw_all_nodes();
		else this.draw_these_nodes([selected_node_id]);
	    } else {
		this.draw_these_nodes([selected_node_id]);
	    }
	}
    }
    
    function new_reaction_for_metabolite(reaction_bigg_id, selected_node_id) {
	/** Build a new reaction starting with selected_met.

	 Undoable

	 */

        // If reaction id is not new, then return:
	for (var reaction_id in this.reactions) {
	    if (this.reactions[reaction_id].bigg_id == reaction_bigg_id) {
		console.warn('reaction is already drawn');
                return;
	    }
        }

	// get the metabolite node
	var selected_node = this.nodes[selected_node_id];

        // set reaction coordinates and angle
        // be sure to copy the reaction recursively
        var cobra_reaction = this.cobra_model.reactions[reaction_bigg_id];

	// build the new reaction
	var out = build.new_reaction(reaction_bigg_id, cobra_reaction,
				     this.cobra_model.metabolites,
				     selected_node_id,
				     utils.clone(selected_node),
				     this.largest_ids,
				     this.cobra_model.cofactors,
				     this.direction_arrow.get_rotation()),
	    new_nodes = out.new_nodes,
	    new_reactions = out.new_reactions;

	// draw
	extend_and_draw_reaction.apply(this, [new_nodes, new_reactions, selected_node_id]);

	// clone the nodes and reactions, to redo this action later
	var saved_nodes = utils.clone(new_nodes),
	    saved_reactions = utils.clone(new_reactions),
	    map = this;

	// add to undo/redo stack
	this.undo_stack.push(function() {
	    // undo
	    // get the nodes to delete
	    delete new_nodes[selected_node_id];
	    map.delete_node_data(new_nodes);
	    map.delete_reaction_data(new_reactions);
	    select_metabolite_with_id.apply(map, [selected_node_id]);
	    // save the nodes and reactions again, for redo
	    new_nodes = utils.clone(saved_nodes);
	    new_reactions = utils.clone(saved_reactions);
	    // draw
	    map.draw_everything();
	}, function () {
	    // redo
	    // clone the nodes and reactions, to redo this action later
	    extend_and_draw_reaction.apply(map, [new_nodes, new_reactions, selected_node_id]);
	});

	// definitions
	function extend_and_draw_reaction(new_nodes, new_reactions, selected_node_id) {
	    utils.extend(this.reactions, new_reactions);
	    // remove the selected node so it can be updated
	    delete this.nodes[selected_node_id];
	    utils.extend(this.nodes, new_nodes);

	    // apply the reaction and node data
	    // if the scale changes, redraw everything
	    if (this.has_reaction_data()) {
		var scale_changed = this.apply_reaction_data_to_reactions(new_reactions);
		if (scale_changed) this.draw_all_reactions();
		else this.draw_these_reactions(Object.keys(new_reactions));
	    } else {
		this.draw_these_reactions(Object.keys(new_reactions));
	    }		
	    if (this.has_metabolite_data()) {
		var scale_changed = this.apply_metabolite_data_to_nodes(new_nodes);
		if (scale_changed) this.draw_all_nodes();
		else this.draw_these_nodes(Object.keys(new_nodes));
	    } else {
		this.draw_these_nodes(Object.keys(new_nodes));
	    }

	    // select new primary metabolite
	    for (var node_id in new_nodes) {
		var node = new_nodes[node_id];
		if (node.node_is_primary && node_id!=selected_node_id) {
		    this.select_metabolite_with_id(node_id);
		    var new_coords = { x: node.x, y: node.y };
		    if (this.zoom_container)
			this.zoom_container.translate_off_screen(new_coords);
		}
	    }
	}
	
    }
    function cycle_primary_node() {
	var selected_nodes = this.get_selected_nodes();
	// get the first node
	var node_id = Object.keys(selected_nodes)[0],
	    node = selected_nodes[node_id],
	    reactions = this.reactions,
	    nodes = this.nodes;
	// make the other reactants or products secondary
	// 1. Get the connected anchor nodes for the node
	var connected_anchor_ids = [],
	    reactions_to_draw;
	nodes[node_id].connected_segments.forEach(function(segment_info) {
	    reactions_to_draw = [segment_info.reaction_id];
	    var segment = reactions[segment_info.reaction_id].segments[segment_info.segment_id];
	    connected_anchor_ids.push(segment.from_node_id==node_id ?
				      segment.to_node_id : segment.from_node_id);
	});
	// can only be connected to one anchor
	if (connected_anchor_ids.length != 1)
	    return console.error('Only connected nodes with a single reaction can be selected');
	var connected_anchor_id = connected_anchor_ids[0];
	// 2. find nodes connected to the anchor that are metabolites
	var related_node_ids = [node_id];
	var segments = [];
	nodes[connected_anchor_id].connected_segments.forEach(function(segment_info) { // deterministic order
	    var segment = reactions[segment_info.reaction_id].segments[segment_info.segment_id],
		conn_met_id = segment.from_node_id == connected_anchor_id ? segment.to_node_id : segment.from_node_id,
		conn_node = nodes[conn_met_id];
	    if (conn_node.node_type == 'metabolite' && conn_met_id != node_id) {
		related_node_ids.push(String(conn_met_id));
	    }
	});
	// 3. make sure they only have 1 reaction connection, and check if
	// they match the other selected nodes
	for (var i=0; i<related_node_ids.length; i++) {
	    if (nodes[related_node_ids[i]].connected_segments.length > 1)
		return console.error('Only connected nodes with a single reaction can be selected');
	}
	for (var a_selected_node_id in selected_nodes) {
	    if (a_selected_node_id!=node_id && related_node_ids.indexOf(a_selected_node_id) == -1)
		return console.warn('Selected nodes are not on the same reaction');
	}
	// 4. change the primary node, and change coords, label coords, and beziers
	var nodes_to_draw = [],
	    last_i = related_node_ids.length - 1,
	    last_node = nodes[related_node_ids[last_i]],
	    last_is_primary = last_node.node_is_primary,
	    last_coords = { x: last_node.x, y: last_node.y,
			    label_x: last_node.label_x, label_y: last_node.label_y },
	    last_segment_info = last_node.connected_segments[0], // guaranteed above to have only one
	    last_segment = reactions[last_segment_info.reaction_id].segments[last_segment_info.segment_id],
	    last_bezier = { b1: last_segment.b1, b2: last_segment.b2 },
	    primary_node_id;
	related_node_ids.forEach(function(related_node_id) {
	    var node = nodes[related_node_id],
		this_is_primary = node.node_is_primary,
		these_coords = { x: node.x, y: node.y,
				 label_x: node.label_x, label_y: node.label_y },
		this_segment_info = node.connected_segments[0],
		this_segment = reactions[this_segment_info.reaction_id].segments[this_segment_info.segment_id],
		this_bezier = { b1: this_segment.b1, b2: this_segment.b2 };
	    node.node_is_primary = last_is_primary;
	    node.x = last_coords.x; node.y = last_coords.y;
	    node.label_x = last_coords.label_x; node.label_y = last_coords.label_y;
	    this_segment.b1 = last_bezier.b1; this_segment.b2 = last_bezier.b2;
	    last_is_primary = this_is_primary;
	    last_coords = these_coords;
	    last_bezier = this_bezier;
	    if (node.node_is_primary) primary_node_id = related_node_id;
	    nodes_to_draw.push(related_node_id);
	});
	// 5. cycle the connected_segments array so the next time, it cycles differently
	var old_connected_segments = nodes[connected_anchor_id].connected_segments,
	    last_i = old_connected_segments.length - 1,
	    new_connected_segments = [old_connected_segments[last_i]];
	old_connected_segments.forEach(function(segment, i) {
	    if (last_i==i) return;
	    new_connected_segments.push(segment);
	});
	nodes[connected_anchor_id].connected_segments = new_connected_segments;	    
	// 6. draw the nodes
	this.draw_these_nodes(nodes_to_draw);
	this.draw_these_reactions(reactions_to_draw);
	// 7. select the primary node
	this.select_metabolite_with_id(primary_node_id);
    }
    function make_selected_node_primary() {
	var selected_nodes = this.get_selected_nodes(),
	    reactions = this.reactions,
	    nodes = this.nodes;	    
	// can only have one selected
	if (Object.keys(selected_nodes).length != 1)
	    return console.error('Only one node can be selected');
	// get the first node
	var node_id = Object.keys(selected_nodes)[0],
	    node = selected_nodes[node_id];
	// make it primary
	nodes[node_id].node_is_primary = true;
	var nodes_to_draw = [node_id];
	// make the other reactants or products secondary
	// 1. Get the connected anchor nodes for the node
	var connected_anchor_ids = [];
	nodes[node_id].connected_segments.forEach(function(segment_info) {
	    var segment = reactions[segment_info.reaction_id].segments[segment_info.segment_id];
	    connected_anchor_ids.push(segment.from_node_id==node_id ?
				      segment.to_node_id : segment.from_node_id);
	});
	// 2. find nodes connected to the anchor that are metabolites
	connected_anchor_ids.forEach(function(anchor_id) {
	    var segments = [];
	    nodes[anchor_id].connected_segments.forEach(function(segment_info) {
		var segment = reactions[segment_info.reaction_id].segments[segment_info.segment_id],
		    conn_met_id = segment.from_node_id == anchor_id ? segment.to_node_id : segment.from_node_id,
		    conn_node = nodes[conn_met_id];
		if (conn_node.node_type == 'metabolite' && conn_met_id != node_id) {
		    conn_node.node_is_primary = false;
		    nodes_to_draw.push(conn_met_id);
		}
	    });
	});
	// draw the nodes
	this.draw_these_nodes(nodes_to_draw);
    }

    function rotate_selected_nodes() {
	/** Request a center, then listen for rotation, and rotate nodes.

	 */
	this.callback_manager.run('start_rotation');
	
	var selected_nodes = this.get_selected_nodes();
	if (selected_nodes.length < 1) return console.warn('No nodes selected');
	
	var saved_center, total_angle = 0,
	    selected_node_ids = Object.keys(selected_nodes),
	    self = this,
	    reactions = this.reactions,
	    nodes = this.nodes,
	    end_function = function() {
		console.log('end_rotation');
		self.callback_manager.run('end_rotation');
	    };

	choose_center.call(this, function(center) {
	    saved_center = center;
	    listen_for_rotation.call(self, center, function(angle) {
		total_angle += angle;
		var updated = build.rotate_nodes(selected_nodes, reactions,
						 angle, center);
		self.draw_these_nodes(updated.node_ids);
		self.draw_these_reactions(updated.reaction_ids);
	    }, end_function, end_function);
	}, end_function);

	// add to undo/redo stack
	this.undo_stack.push(function() {
	    // undo
	    var these_nodes = {};
	    selected_node_ids.forEach(function(id) { these_nodes[id] = nodes[id]; });
	    var updated = build.rotate_nodes(these_nodes, reactions,
						      -total_angle, saved_center);
	    self.draw_these_nodes(updated.node_ids);
	    self.draw_these_reactions(updated.reaction_ids);
	}, function () {
	    // redo
	    var these_nodes = {};
	    selected_node_ids.forEach(function(id) { these_nodes[id] = nodes[id]; });
	    var updated = build.rotate_nodes(these_nodes, reactions,
						      total_angle, saved_center);
	    self.draw_these_nodes(updated.node_ids);
	    self.draw_these_reactions(updated.reaction_ids);
	});

	// definitions
	function choose_center(callback, callback_canceled) {
	    console.log('Choose center');
	    set_status('Choose a node or point to rotate around.');
	    var selection_node = this.sel.selectAll('.node-circle'),
		selection_background = this.sel.selectAll('#mouse-node'),
		escape_listener = this.key_manager.add_escape_listener(function() {
		    console.log('choose_center escape');
		    selection_node.on('mousedown.center', null);
		    selection_background.on('mousedown.center', null);
		    set_status('');
		    callback_canceled();
		});
	    // if the user clicks a metabolite node
	    selection_node.on('mousedown.center', function(d) {		    
		console.log('mousedown.center');
		// turn off the click listeners to prepare for drag
		selection_node.on('mousedown.center', null);
		selection_background.on('mousedown.center', null);
		set_status('');
		escape_listener.clear();
		// find the location of the clicked metabolite
		var center = { x: d.x, y: d.y };
		callback(center); 
	    });
	    // if the user clicks a point
	    selection_background.on('mousedown.center', function() {
		console.log('mousedown.center');
		// turn off the click listeners to prepare for drag
		selection_node.on('mousedown.center', null);
		selection_background.on('mousedown.center', null);
		set_status('');
		escape_listener.clear();
		// find the point on the background node where the user clicked
		var center = { x: d3.mouse(self.sel.node())[0], 
			       y: d3.mouse(self.sel.node())[1] };
		callback(center); 
	    });
	}
	function listen_for_rotation(center, callback, callback_finished, 
				     callback_canceled) {
	    this.set_status('Drag to rotate.');
	    this.zoom_container.toggle_zoom(false);
	    var angle = Math.PI/2,
		selection = this.sel.selectAll('#mouse-node'),
		drag = d3.behavior.drag(),
		escape_listener = this.key_manager.add_escape_listener(function() {
		    console.log('listen_for_rotation escape');
		    drag.on('drag.rotate', null);
		    drag.on('dragend.rotate', null);
		    set_status('');
		    callback_canceled();
		});
	    // drag.origin(function() { return point_of_grab; });
	    drag.on("drag.rotate", function() { 
		callback(angle_for_event({ dx: d3.event.dx, 
					   dy: d3.event.dy },
					 { x: d3.mouse(this)[0],
					   y: d3.mouse(this)[1] },
					 center));
	    }).on("dragend.rotate", function() {
		console.log('dragend.rotate');
		drag.on('drag.rotate', null);
		drag.on('dragend.rotate', null);
		set_status('');
		escape_listener.clear();
		callback_finished();
	    });
	    selection.call(drag);

	    // definitions
	    function angle_for_event(displacement, point, center) {
		var gamma =  Math.atan2((point.x - center.x), (center.y - point.y)),
		    beta = Math.atan2((point.x - center.x + displacement.dx), 
				      (center.y - point.y - displacement.dy)),
		    angle = beta - gamma;
		return angle;
	    }
	}
    }

    function segments_and_reactions_for_nodes(nodes) {
	/** Get segments and reactions that should be deleted with node deletions
	 */
	var segment_objs_w_segments = [],
	    these_reactions = {},
	    segment_ids_for_reactions = {},
	    reactions = this.reactions;
	// for each node
	for (var node_id in nodes) {
	    var node = nodes[node_id];
	    // find associated segments and reactions	    
	    node.connected_segments.forEach(function(segment_obj) {
		var reaction = reactions[segment_obj.reaction_id],
		    segment = reaction.segments[segment_obj.segment_id],
		    segment_obj_w_segment = utils.clone(segment_obj);
		segment_obj_w_segment['segment'] = utils.clone(segment);
		segment_objs_w_segments.push(segment_obj_w_segment);
		if (!(segment_obj.reaction_id in segment_ids_for_reactions))
		    segment_ids_for_reactions[segment_obj.reaction_id] = [];
		segment_ids_for_reactions[segment_obj.reaction_id].push(segment_obj.segment_id);
	    });
	}
	// find the reactions that should be deleted because they have no segments left
	for (var reaction_id in segment_ids_for_reactions) {
	    var reaction = reactions[reaction_id],
		these_ids = segment_ids_for_reactions[reaction_id],
		has = true;
	    for (var segment_id in reaction.segments) {
		if (these_ids.indexOf(segment_id)==-1) has = false;
	    }
	    if (has) these_reactions[reaction_id] = reaction;
	}
	return { segment_objs_w_segments: segment_objs_w_segments, reactions: these_reactions };
    }
    function set_status(status) {
        // TODO make this a class, and take out d3.select('body')
        var t = d3.select('body').select('#status');
        if (t.empty()) t = d3.select('body')
	    .append('text')
	    .attr('id', 'status');
        t.text(status);
        return this;
    }

    function zoom_extent_nodes(margin) {
	/** Zoom to fit all the nodes.

	 margin: optional argument to set the margins as a fraction of height.

	 Returns error if one is raised.

	 */
	this._zoom_extent(margin, 'nodes');
    }
    function zoom_extent_canvas(margin) {
	/** Zoom to fit the canvas.

	 margin: optional argument to set the margins as a fraction of height.

	 Returns error if one is raised.

	 */
	this._zoom_extent(margin, 'canvas');
    }
    function _zoom_extent(margin, mode) {
	/** Zoom to fit all the nodes.

	 margin: optional argument to set the margins.
	 mode: Values are 'nodes', 'canvas'.

	 Returns error if one is raised.

	 */

	// optional args
	if (margin===undefined) margin = (mode=='nodes' ? 0.2 : 0);
	if (mode===undefined) mode = 'canvas';

	var new_zoom, new_pos,
	    size = this.get_size();
	// scale margin to window size
	margin = margin * size.height;

	if (mode=='nodes') {
	    // get the extent of the nodes
	    var min = { x: null, y: null }, // TODO make infinity?
		max = { x: null, y: null };
	    for (var node_id in this.nodes) {
		var node = this.nodes[node_id];
		if (min.x===null) min.x = node.x;
		if (min.y===null) min.y = node.y;
		if (max.x===null) max.x = node.x;
		if (max.y===null) max.y = node.y;

		min.x = Math.min(min.x, node.x);
		min.y = Math.min(min.y, node.y);
		max.x = Math.max(max.x, node.x);
		max.y = Math.max(max.y, node.y);
	    }
	    // set the zoom
	    new_zoom = Math.min((size.width - margin*2) / (max.x - min.x),
				(size.height - margin*2) / (max.y - min.y));
	    new_pos = { x: - (min.x * new_zoom) + margin + ((size.width - margin*2 - (max.x - min.x)*new_zoom) / 2),
			y: - (min.y * new_zoom) + margin + ((size.height - margin*2 - (max.y - min.y)*new_zoom) / 2) };
	} else if (mode=='canvas') {
	    // center the canvas
	    new_zoom =  Math.min((size.width - margin*2) / (this.canvas.width),
				 (size.height - margin*2) / (this.canvas.height));
	    new_pos = { x: - (this.canvas.x * new_zoom) + margin + ((size.width - margin*2 - this.canvas.width*new_zoom) / 2),
			y: - (this.canvas.y * new_zoom) + margin + ((size.height - margin*2 - this.canvas.height*new_zoom) / 2) };
	} else {
	    return console.error('Did not recognize mode');
	}
	this.zoom_container.go_to(new_zoom, new_pos);
	return null;
    }

    function get_size() {
	return this.zoom_container.get_size();
    }

    // -------------------------------------------------------------------------
    // IO

    function save() {
        console.log("Saving");
        utils.download_json(this.map_for_export(), "saved_map");
    }
    function map_for_export() {
	var out = { reactions: utils.clone(this.reactions),
		    nodes: utils.clone(this.nodes),
		    membranes: utils.clone(this.membranes),
		    text_labels: utils.clone(this.text_labels),
		    canvas: this.canvas.size_and_location() };

	// remove extra data
	for (var r_id in out.reactions) {
	    var reaction = out.reactions[r_id];
	    delete reaction.data;
	    delete reaction.data_string;
	    for (var s_id in reaction.segments) {
		var segment = reaction.segments[s_id];
		delete segment.reversibility;
		delete segment.from_node_coefficient;
		delete segment.to_node_coefficient;
		delete segment.data;
	    }
	}
	for (var n_id in out.nodes) {
	    var node = out.nodes[n_id];
	    delete node.data;
	    delete node.data_string;
	}

	if (this.debug) {
	    d3.json('map_spec.json', function(error, spec) {
		if (error) {
		    console.warn(error);
		    return;
		}
		utils.check_r(out, spec.spec, spec.can_be_none);
	    });
	}

	return out;
    }
    function save_svg() {
        console.log("Exporting SVG");
	this.callback_manager.run('before_svg_export');
	// turn of zoom and translate so that illustrator likes the map
	var window_scale = this.zoom_container.window_scale,
	    window_translate = this.zoom_container.window_translate,
	//     svg_width = this.svg.attr('width'),
	//     svg_height = this.svg.attr('height'),
	    canvas_size_and_loc = this.canvas.size_and_location();
	// console.log('Check that these are not null:');
	// console.log(svg_width, svg_height);
	this.zoom_container.go_to(1.0, {x: -canvas_size_and_loc.x, y: -canvas_size_and_loc.y}, true);
	this.svg.attr('width', canvas_size_and_loc.width);
	this.svg.attr('height', canvas_size_and_loc.height);
        utils.export_svg("saved_map", this.svg, true);
	this.zoom_container.go_to(window_scale, window_translate, true);
	this.svg.attr('width', null);
	this.svg.attr('height', null);
	this.callback_manager.run('after_svg_export');
    }
});

define('ZoomContainer',["utils", "CallbackManager"], function(utils, CallbackManager) {
    /** ZoomContainer

     The zoom behavior is based on this SO question:
     http://stackoverflow.com/questions/18788188/how-to-temporarily-disable-the-zooming-in-d3-js
     */
    var ZoomContainer = utils.make_class();
    ZoomContainer.prototype = { init: init,
				toggle_zoom: toggle_zoom,
				go_to: go_to,
				zoom_by: zoom_by,
				zoom_in: zoom_in,
				zoom_out: zoom_out,
				get_size: get_size,
				translate_off_screen: translate_off_screen,
				reset: reset };
    return ZoomContainer;

    // definitions
    function init(selection, size_container) {
	/** Make a container that will manage panning and zooming.

	 selection: A d3 selection of an 'svg' or 'g' node to put the zoom
	 container in.

	 size_container: A d3 selection of a 'div' node that has defined width
	 and height.

	 */

	this.zoom_on = true;
	this.initial_zoom = 1.0;
	this.window_translate = {x: 0, y: 0};
	this.window_scale = 1.0;

	// set up the callbacks
	this.callback_manager = new CallbackManager();

	// save the size_container
	this.size_container = size_container;

        // set up the container
        selection.select("#zoom-container").remove();
        var container = selection.append("g")
                .attr("id", "zoom-container");
        this.zoomed_sel = container.append("g");

	// the zoom function and behavior
        var zoom = function(zoom_container, event) {
	    if (zoom_container.zoom_on) {
                zoom_container.zoomed_sel.attr("transform", "translate(" + event.translate + ")" +
					       "scale(" + event.scale + ")");
		zoom_container.window_translate = {'x': event.translate[0],
						   'y': event.translate[1]};
		zoom_container.window_scale = event.scale;
		zoom_container.callback_manager.run('zoom');
	    }
        };
	var zoom_container = this;
	this.zoom_behavior = d3.behavior.zoom()
	    .on("zoom", function() {
		zoom(zoom_container, d3.event);
	    });
	container.call(this.zoom_behavior);

	this.saved_scale = null;
	this.saved_translate = null;
    }

    function toggle_zoom(on_off) {
	/** Toggle the zoom state, and remember zoom when the behavior is off.

	 */
	if (on_off===undefined) {
	    this.zoom_on = !this.zoom_on;
	} else {
	    this.zoom_on = on_off;
	}
	if (this.zoom_on) {
	    if (this.saved_scale !== null){
		this.zoom_behavior.scale(this.saved_scale);
		this.saved_scale = null;
	    }
	    if (this.saved_translate !== null){
		this.zoom_behavior.translate(this.saved_translate);
		this.saved_translate = null;
	    }
	} else {
	    if (this.saved_scale === null){
		this.saved_scale = utils.clone(this.zoom_behavior.scale());
	    }
	    if (this.saved_translate === null){
		this.saved_translate = utils.clone(this.zoom_behavior.translate());
	    }      
	}
    }

    // functions to scale and translate
    function go_to(scale, translate, show_transition) {
	utils.check_undefined(arguments, ['scale', 'translate']);
	if (show_transition===undefined) show_transition = true;

	if (!scale) return console.error('Bad scale value');
	if (!translate || !('x' in translate) || !('y' in translate) ||
	    isNaN(translate.x) || isNaN(translate.y))
	    return console.error('Bad translate value');

	this.zoom_behavior.scale(scale);
	this.window_scale = scale;
	if (this.saved_scale !== null) this.saved_scale = scale;

	var translate_array = [translate.x, translate.y];
	this.zoom_behavior.translate(translate_array);
        this.window_translate = translate;
	if (this.saved_translate !== null) this.saved_translate = translate_array;

	var move_this = (show_transition ?
			 this.zoomed_sel.transition() :
			 this.zoomed_sel);
        move_this.attr('transform',
		  'translate('+this.window_translate.x+','+this.window_translate.y+')'+
		  'scale('+this.window_scale+')');
	return null;
    }

    function zoom_by(amount) {
	var size = this.get_size(),
	    shift = { x: size.width/2 - ((size.width/2 - this.window_translate.x) * amount +
					 this.window_translate.x),
	 	      y: size.height/2 - ((size.height/2 - this.window_translate.y) * amount +
					  this.window_translate.y) };
	this.go_to(this.window_scale*amount,
		   utils.c_plus_c(this.window_translate, shift),
		   true);
    }
    function zoom_in() {
	this.zoom_by(1.5);
    }
    function zoom_out() {
	this.zoom_by(0.667);
    }

    function get_size() {
	return { width: parseInt(this.size_container.style('width'), 10),
		 height: parseInt(this.size_container.style('height'), 10) };
    }

    function translate_off_screen(coords) {
        // shift window if new reaction will draw off the screen
        // TODO BUG not accounting for scale correctly
        var margin = 80, // pixels
	    current = {'x': {'min': - this.window_translate.x / this.window_scale +
			     margin / this.window_scale,
			     'max': - this.window_translate.x / this.window_scale +
			     (this.width-margin) / this.window_scale },
		       'y': {'min': - this.window_translate.y / this.window_scale +
			     margin / this.window_scale,
			     'max': - this.window_translate.y / this.window_scale +
			     (this.height-margin) / this.window_scale } };
        if (coords.x < current.x.min) {
            this.window_translate.x = this.window_translate.x -
		(coords.x - current.x.min) * this.window_scale;
            this.go_to(this.window_scale, this.window_translate);
        } else if (coords.x > current.x.max) {
            this.window_translate.x = this.window_translate.x -
		(coords.x - current.x.max) * this.window_scale;
            this.go_to(this.window_scale, this.window_translate);
        }
        if (coords.y < current.y.min) {
            this.window_translate.y = this.window_translate.y -
		(coords.y - current.y.min) * this.window_scale;
            this.go_to(this.window_scale, this.window_translate);
        } else if (coords.y > current.y.max) {
            this.window_translate.y = this.window_translate.y -
		(coords.y - current.y.max) * this.window_scale;
            this.go_to(this.window_scale, this.window_translate);
        }
    }
    function reset() {
	this.go_to(1.0, {x: 0.0, y: 0.0});
    }
});

define('Input',["utils",  "lib/complete.ly", "Map", "ZoomContainer", "CallbackManager", "draw"], function(utils, completely, Map, ZoomContainer, CallbackManager, draw) {
    /**
     */

    var Input = utils.make_class();
    // instance methods
    Input.prototype = { init: init,
			setup_map_callbacks: setup_map_callbacks,
			setup_zoom_callbacks: setup_zoom_callbacks,
			is_visible: is_visible,
			toggle: toggle,
			place_at_selected: place_at_selected,
			place: place,
			reload_at_selected: reload_at_selected,
			reload: reload,
			toggle_start_reaction_listener: toggle_start_reaction_listener };

    return Input;

    // definitions
    function init(selection, map, zoom_container) {
	// set up container
	var new_sel = selection.append("div").attr("id", "rxn-input");
	// set up complete.ly
	var c = completely(new_sel.node(), { backgroundColor: "#eee" });
	d3.select(c.input)
	// .attr('placeholder', 'Reaction ID -- Flux')
	    .on('input', function() {
		this.value = this.value.replace("/","")
		    .replace(" ","")
		    .replace("\\","")
		    .replace("<","");
	    });
	this.selection = new_sel;
	this.completely = c;
	// close button
	var self = this;
	new_sel.append('button').attr('class', "button input-close-button")
	    .text("×").on('click', function() { self.toggle(false); });;

	if (map instanceof Map) {
	    this.map = map;
	    this.setup_map_callbacks();
	} else {
	    console.error('Cannot set the map. It is not an instance of builder/Map');
	}
	if (zoom_container instanceof ZoomContainer) {
	    this.zoom_container = zoom_container;
	    this.setup_zoom_callbacks();
	} else {
	    console.error('Cannot set the zoom_container. It is not an instance of ' +
			  'builder/ZoomContainer');
	}

	// set up reaction input callbacks
	this.callback_manager = new CallbackManager();

	// toggle off
	this.toggle(false);
    }
    function setup_map_callbacks() {
	var self = this;
	this.map.callback_manager.set('select_metabolite_with_id.input', function(selected_node, coords) {
	    if (self.is_active) self.reload(selected_node, coords, false);
	    self.map.sel.selectAll('.start-reaction-target').style('visibility', 'hidden');
	});
	this.map.callback_manager.set('select_metabolite.input', function(count, selected_node, coords) {
	    self.map.sel.selectAll('.start-reaction-target').style('visibility', 'hidden');
	    if (count == 1 && self.is_active && coords) {
		self.reload(selected_node, coords, false);
	    } else {
		self.toggle(false);
	    }
	});
    }
    function setup_zoom_callbacks() {
	var self = this;
	this.zoom_container.callback_manager.set('zoom.input', function() {
	    if (self.is_active) {
		self.place_at_selected();
	    }
	});
    }
    function is_visible() {
	return this.selection.style('display') != 'none';
    }
    function toggle(on_off) {
	if (on_off===undefined) this.is_active = !this.is_active;
	else this.is_active = on_off;
	if (this.is_active) {
	    this.toggle_start_reaction_listener(true);
	    this.reload_at_selected();
	    this.map.set_status('Click on the canvas or an existing metabolite');
	    this.callback_manager.run('show_reaction_input');
	} else {
	    this.toggle_start_reaction_listener(false);
	    this.selection.style("display", "none");
            this.completely.input.blur();
            this.completely.hideDropDown();
	    this.map.set_status(null);
	    this.callback_manager.run('hide_reaction_input');
	}
    }

    function place_at_selected() {
        /** Place autocomplete box at the first selected node.
	 
         */

	// get the selected node
	this.map.deselect_text_labels();
	var selected_node = this.map.select_single_node();
	if (selected_node==null) return;
	var coords = { x: selected_node.x, y: selected_node.y };
	this.place(coords);
    }
    function place(coords) {
	var d = {x: 200, y: 0},
	    window_translate = this.map.zoom_container.window_translate,
	    window_scale = this.map.zoom_container.window_scale,
	    map_size = this.map.get_size();
        var left = Math.max(20,
			    Math.min(map_size.width - 270,
				     (window_scale * coords.x + window_translate.x - d.x)));
        var top = Math.max(20,
			   Math.min(map_size.height - 40,
				    (window_scale * coords.y + window_translate.y - d.y)));
        this.selection.style('position', 'absolute')
            .style('display', 'block')
            .style('left',left+'px')
            .style('top',top+'px');
    }

    function reload_at_selected() {
        /** Reload data for autocomplete box and redraw box at the first
	 selected node.
	 
         */
	// get the selected node
	this.map.deselect_text_labels();
	var selected_node = this.map.select_single_node();
	if (selected_node==null) return;
	var coords = { x: selected_node.x, y: selected_node.y };
	// reload the reaction input
	this.reload(selected_node, coords, false);
    }
    function reload(selected_node, coords, starting_from_scratch) {
        /** Reload data for autocomplete box and redraw box at the new
         coordinates.
	 
         */

	if (selected_node===undefined && !starting_from_scratch)
	    console.error('No selected node, and not starting from scratch');

	this.place(coords);
        // blur
        this.completely.input.blur();
        this.completely.repaint(); //put in place()?

	if (this.map.cobra_model===null) {
	    this.completely.setText('Cannot add: No model.');
	    return;
	}

        // Find selected reaction
        var suggestions = [],
	    cobra_reactions = this.map.cobra_model.reactions,
	    cobra_metabolites = this.map.cobra_model.metabolites,
	    reactions = this.map.reactions,
	    has_reaction_data = this.map.has_reaction_data(),
	    reaction_data = this.map.reaction_data,
	    reaction_data_styles = this.map.reaction_data_styles;
        for (var reaction_id in cobra_reactions) {
            var reaction = cobra_reactions[reaction_id];

            // ignore drawn reactions
            if (already_drawn(reaction_id, reactions)) continue;

	    // check segments for match to selected metabolite
	    for (var metabolite_id in reaction.metabolites) {

		// if starting with a selected metabolite, check for that id
		if (starting_from_scratch || metabolite_id==selected_node.bigg_id) {
		    // don't add suggestions twice
		    if (reaction_id in suggestions) continue;
		    if (has_reaction_data) {
			suggestions[reaction_id] = { reaction_data: reaction.data,
						     string: (reaction_id + ': ' +
							      reaction.data_string) };
		    } else {
	    		suggestions[reaction_id] = { string: reaction_id };
		    }
		}
	    }
        }

        // Generate the array of reactions to suggest and sort it
	var strings_to_display = [],
	    suggestions_array = utils.make_array(suggestions, 'reaction_abbreviation');
	if (has_reaction_data) {
	    suggestions_array.sort(function(x, y) {
		return Math.abs(y.reaction_data) - Math.abs(x.reaction_data);
	    });
	} else {
	    suggestions_array.sort(function(x, y) {
		return (x.string.toLowerCase() < y.string.toLowerCase() ? -1 : 1);
	    });
	}
	suggestions_array.forEach(function(x) {
	    strings_to_display.push(x.string);
	});

        // set up the box with data, searching for first num results
        var num = 20,
            complete = this.completely,
	    self = this;
        complete.options = strings_to_display;
        if (strings_to_display.length==1) complete.setText(strings_to_display[0]);
        else complete.setText("");
	complete.onChange = function(txt) {
	    if (txt.length==0) {
		complete.options = strings_to_display;
		complete.repaint();
		return;
	    }
	    var v = strings_to_display.map(function(x) {
		if (x.toLowerCase().indexOf(txt.toLowerCase())==0)
		    return txt+x.slice(txt.length);
		else return null;
	    }).filter(function(x) { return x!==null; });
	    complete.options = v;
	    complete.repaint();
	};
        complete.onEnter = function() {
	    var text = this.getText();
	    this.setText("");
	    suggestions_array.forEach(function(x) {
		if (x.string.toLowerCase()==text.toLowerCase()) {
		    if (starting_from_scratch) {
			self.map.new_reaction_from_scratch(x.reaction_abbreviation,
							   coords);
		    } else {
			self.map.new_reaction_for_metabolite(x.reaction_abbreviation,
							     selected_node.node_id);
		    }
		}
	    });
        };
        complete.repaint();
        this.completely.input.focus();

	//definitions
	function already_drawn(bigg_id, reactions) {
            for (var drawn_id in reactions) {
		if (reactions[drawn_id].bigg_id==bigg_id) 
		    return true;
	    }
            return false;
	};
    }
    function toggle_start_reaction_listener(on_off) {
	/** Toggle listening for a click to place a new reaction on the canvas.

	 */
        if (on_off===undefined)
            this.start_reaction_listener = !this.start_reaction_listener;
        else if (this.start_reaction_listener==on_off)
            return;
        else
            this.start_reaction_listener = on_off;
        
        if (this.start_reaction_listener) {
	    var self = this,
		map = this.map;
            map.sel.on('click.start_reaction', function() {
                console.log('clicked for new reaction');
                // reload the reaction input
                var coords = { x: d3.mouse(this)[0],
			       y: d3.mouse(this)[1] };
                // unselect metabolites
		map.deselect_nodes();
		map.deselect_text_labels();
		// reload the reactin input
                self.reload(null, coords, true);
		// generate the target symbol
                var s = map.sel.selectAll('.start-reaction-target').data([12, 5]);
                s.enter().append('circle')
                    .classed('start-reaction-target', true)
                    .attr('r', function(d) { return d; })
                    .style('stroke-width', 4);
                s.style('visibility', 'visible')
                    .attr('transform', 'translate('+coords.x+','+coords.y+')');
            });
            map.sel.classed('start-reaction-cursor', true);
        } else {
            this.map.sel.on('click.start_reaction', null);
            this.map.sel.classed('start-reaction-cursor', false);
            this.map.sel.selectAll('.start-reaction-target').style('visibility', 'hidden');
        }
    }

});

define('CobraModel',["utils", "data_styles"], function(utils, data_styles) {
    /**
     */

    var CobraModel = utils.make_class();
    // instance methods
    CobraModel.prototype = { init: init,
			     apply_reaction_data: apply_reaction_data,
			     apply_metabolite_data: apply_metabolite_data };

    return CobraModel;

    // instance methods
    function init(model_data) {
	// reactions and metabolites
	if (!(model_data.reactions && model_data.metabolites)) {
	    throw new Error('Bad model data.');
	    return;
	}
	this.reactions = {};
	for (var i=0, l=model_data.reactions.length; i<l; i++) {
	    var r = model_data.reactions[i];
	    this.reactions[r.id] = r;
	}
	this.metabolites = {};
	for (var i=0, l=model_data.metabolites.length; i<l; i++) {
	    var r = model_data.metabolites[i];
	    this.metabolites[r.id] = r;
	}

	// get cofactors if preset
	if ('cofactors' in model_data) {
	    if (model_data.cofactors instanceof Array) {
		this.cofactors = model_data.cofactors;
	    } else {
		console.warn('model_data.cofactors should be an array. Ignoring it');
		this.cofactors = [];
	    }
	} else {
	    this.cofactors = [];
	}
    }

    function apply_reaction_data(reaction_data, styles) {
	for (var reaction_id in this.reactions) {
	    var reaction = this.reactions[reaction_id];
	    if (reaction_data===null) {
		reaction.data = null;
		reaction.data_string = '';
	    } else {
		var d = (reaction_id in reaction_data ?
			 reaction_data[reaction_id] : null),
		    f = data_styles.float_for_data(d, styles),
		    s = data_styles.text_for_data(d, styles);
		reaction.data = f;
		reaction.data_string = s;
	    }
	}
    }

    function apply_metabolite_data(metabolite_data, styles) {
	for (var metabolite_id in this.metabolites) {
	    var metabolite = this.metabolites[metabolite_id];
	    if (metabolite_data===null) {
		metabolite.data = null;
		metabolite.data_string = '';
	    } else {
		var d = (metabolite_id in metabolite_data ?
			 metabolite_data[metabolite_id] : null),
		    f = data_styles.float_for_data(d, styles),
		    s = data_styles.text_for_data(d, styles);
		metabolite.data = f;
		metabolite.data_string = s;
	    }
	}
    }
});

define('Brush',["utils"], function(utils) {
    /** Define a brush to select elements in a map.

     Brush(selection, is_enabled, map, insert_after)

     insert_after: A d3 selector string to choose the svg element that the brush
     will be inserted after. Often a canvas element (e.g. '.canvas-group').

     */

    var Brush = utils.make_class();
    Brush.prototype = { init: init,
			toggle: toggle,
			setup_selection_brush: setup_selection_brush };

    return Brush;

    // definitions
    function init(selection, is_enabled, map, insert_after) {
	this.brush_sel = selection.append('g')
	    .attr('id', 'brush-container');
	var node = this.brush_sel.node(),
	    insert_before_node = selection.select(insert_after).node().nextSibling;
	if (!(node===insert_before_node))
	    node.parentNode.insertBefore(node, insert_before_node);
	this.enabled = is_enabled;
	this.map = map;
    };

    function brush_is_enabled() {
	/** Returns a boolean for the on/off status of the brush

	 */
	return this.map.sel.select('.brush').empty();
    }
    function toggle(on_off) {
	/** Turn the brush on or off

	 */
	if (on_off===undefined) on_off = !this.enabled;

	if (on_off) {
	    this.selection_brush = this.setup_selection_brush();
	} else {
	    this.brush_sel.selectAll('.brush').remove();
	}
    }	
    function setup_selection_brush() {
	var selection = this.brush_sel, 
	    node_selection = this.map.sel.select('#nodes').selectAll('.node'),
	    size_and_location = this.map.canvas.size_and_location(),
	    map = this.map,
	    width = size_and_location.width,
	    height = size_and_location.height,
	    x = size_and_location.x,
	    y = size_and_location.y,
	    node_ids = [];
	node_selection.each(function(d) { node_ids.push(d.node_id); });
	var brush_fn = d3.svg.brush()
		.x(d3.scale.identity().domain([x, x+width]))
		.y(d3.scale.identity().domain([y, y+height]))
		.on("brush", function() {
		    var extent = d3.event.target.extent();
		    node_selection
			.classed("selected", function(d) { 
			    var sx = d.x, sy = d.y;
			    return extent[0][0] <= sx && sx < extent[1][0]
				&& extent[0][1] <= sy && sy < extent[1][1];
			});
		})        
		.on("brushend", function() {
		    d3.event.target.clear();
		    d3.select(this).call(d3.event.target);
		}),
	    brush = selection.append("g")
		.attr("class", "brush")
		.call(brush_fn);
	return brush;
    }
});

define('ui',["utils"], function(utils) {
    return { individual_button: individual_button,
	     radio_button_group: radio_button_group,
	     dropdown_menu: dropdown_menu,
	     set_button: set_button,
	     set_input_button: set_input_button };

    function individual_button(s, button) {
	var b = s.append('li')
		.append('button').attr('class', 'btn btn-default'),
	    c = b.append('span');
	if ('id' in button) b.attr('id', button.id);
	if ('text' in button) c.text(button.text);
	if ('icon' in button) c.classed(button.icon, true);
	if ('key' in button) set_button(b, button.key);
	// if ('tooltip' in button) 
	b.attr('title', button.tooltip);
    }
    function radio_button_group(s) {
	var s2 = s.append('li')
		.attr('class', 'btn-group-vertical')
		.attr('data-toggle', 'buttons');
	return { button: function(button) {
	    var b = s2.append("label")
		    .attr("class", "btn btn-default");
	    b.append('input').attr('type', 'radio');
	    var c = b.append("span");
	    if ('id' in button) b.attr('id', button.id);
	    if ('text' in button) c.text(button.text);
	    if ('icon' in button) c.classed(button.icon, true);
	    if ('key' in button) set_button(b, button.key);
	    if ('tooltip' in button) b.attr('title', button.tooltip);
	    return this;
	}};
    }
    function dropdown_menu(s, name, pull_right) {
	if (pull_right === undefined) pull_right = false;
	var s2 = s.append('li')
		.attr('class', 'dropdown');
	s2.append('button').text(name+" ")
	    .attr('class', 'btn btn-link btn-sm dropdown-button')
	    .attr('data-toggle', 'dropdown')
	    .append('b').attr('class', 'caret');
	var ul = s2.append('ul')
		.attr('class', 'dropdown-menu')
		.classed('pull-right', pull_right)
		.attr('role', 'menu')
		.attr('aria-labelledby', 'dLabel');
	return {
	    button: function(button) {
		var li = ul.append("li")
			.attr('role', 'presentation'),
		    link = li.append("a")
			.attr('href', '#'),
		    icon = link.append('span'),
		    text = link.append('span');
		if ('id' in button) li.attr('id', button.id);
		if ('text' in button) text.text(" "+button.text);
		if ('icon' in button) icon.classed(button.icon, true);
		
		if ('key' in button) {
		    set_button(link, button.key);
		} else if ('input' in button) {
		    var input = button.input,
			out = set_input_button(link, li, input.fn, input.target);
		    if ('assign' in input && 'key' in input)
			input.assign[input.key] = out;
		}
		return this;
	    },
	    divider: function() {
		ul.append("li")
		    .attr('role', 'presentation')
		    .attr('class', 'divider');
		return this;
	    }
	};
    }
    function set_button(b, key, name) {
	if (name !== undefined) b.text(name);
	b.on("click", function() {
	    key.fn.call(key.target);
	});
    }
    function set_input_button(b, s, fn, target) {
	var input = s.append("input")
		.attr("type", "file")
		.style("display", "none")
		.on("change", function() { utils.load_json(this.files[0], fn, target); });
	b.on('click', function(e) {
	    input.node().click();
	});
	return function() { input.node().click(); };
    }
});


define('Builder',["utils", "Input", "ZoomContainer", "Map", "CobraModel", "Brush", "CallbackManager", "ui"], function(utils, Input, ZoomContainer, Map, CobraModel, Brush, CallbackManager, ui) {
    // NOTE
    // see this thread: https://groups.google.com/forum/#!topic/d3-js/Not1zyWJUlg
    // only necessary for selectAll()
    // .datum(function() {
    //     return this.parentNode.__data__;
    // })

    var Builder = utils.make_class();
    Builder.prototype = { init: init,
			  reload_builder: reload_builder,
			  set_mode: set_mode,
			  build_mode: build_mode,
			  brush_mode: brush_mode,
			  zoom_mode: zoom_mode,
			  rotate_mode: rotate_mode,
			  _setup_menu: _setup_menu,
			  _setup_status: _setup_status,
			  _setup_modes: _setup_modes,
			  _get_keys: _get_keys };

    return Builder;

    // definitions
    function init(options) {
	// set defaults
	var o = utils.set_options(options, {
	    margins: {top: 0, right: 0, bottom: 0, left: 0},
	    selection: d3.select("body").append("div"),
	    selection_is_svg: false,
	    fillScreen: false,
	    enable_editing: true,
	    enable_menu: true,
	    enable_keys: true,
	    on_load: null,
	    map_path: null,
	    map: null,
	    cobra_model_path: null,
	    cobra_model: null,
	    css_path: null,
	    css: null,
	    reaction_data_path: null,
	    reaction_data: null,
	    reaction_data_styles: ['Color', 'Size', 'Abs', 'Diff'],
	    metabolite_data: null,
	    metabolite_data_path: null,
	    metabolite_data_styles: ['Color', 'Size', 'Diff'],
	    show_beziers: false,
	    debug: false,
	    starting_reaction: 'GLCtex'
	});
	
	// TODO make each option is neither {}, undefined, nor null
	// for all cases, set to null to boolean(option) === false


	if (o.selection_is_svg) {
	    // TODO fix this
	    console.error("Builder does not support placement within svg elements");
	    return;
	}

	this.o = o;
	var files_to_load = [{ file: o.map_path, value: o.map,
			       callback: set_map_data },
			     { file: o.cobra_model_path, value: o.cobra_model,
			       callback: set_cobra_model },
			     { file: o.css_path, value: o.css,
			       callback: set_css },
			     { file: o.reaction_data_path, value: o.reaction_data,
			       callback: set_reaction_data },
			     { file: o.metabolite_data_path, value: o.metabolite_data,
			       callback: set_metabolite_data } ];
	utils.load_files(this, files_to_load, reload_builder);
	return;

	// definitions
	function set_map_data(error, map_data) {
	    if (error) console.warn(error);
	    this.o.map_data = map_data;
	}
	function set_cobra_model(error, cobra_model) {
	    if (error) console.warn(error);
	    this.o.cobra_model = cobra_model;
	}
	function set_css(error, css) {
	    if (error) console.warn(error);
	    this.o.css = css;
	}
	function set_reaction_data(error, data) {
	    if (error) console.warn(error);
	    this.o.reaction_data = data;
	}
	function set_metabolite_data(error, data) {
	    if (error) console.warn(error);
	    this.o.metabolite_data = data;
	}
    }

    // Definitions
    function reload_builder() {
	/** Load the svg container and draw a loaded map if provided.
	 
	 */

	// Begin with some definitions
	var node_click_enabled = true,
	    shift_key_on = false;

	// set up this callback manager
	this.callback_manager = CallbackManager();

	// Check the cobra model
	var cobra_model_obj = null;
	if (this.o.cobra_model!==null) {
	    cobra_model_obj = CobraModel(this.o.cobra_model);
	} else {
	    console.warn('No cobra model was loaded.');
	}

	// remove the old builder
	utils.remove_child_nodes(this.o.selection);

	// set up the svg
	var svg = utils.setup_svg(this.o.selection, this.o.selection_is_svg,
				  this.o.margins, this.o.fill_screen);
	
	// se up the zoom container
	this.zoom_container = new ZoomContainer(svg, this.o.selection);
	var zoomed_sel = this.zoom_container.zoomed_sel;

	if (this.o.map_data!==null) {
	    // import map
	    this.map = Map.from_data(this.o.map_data,
				     svg, this.o.css,
				     zoomed_sel,
				     this.zoom_container,
				     this.o.reaction_data,
				     this.o.reaction_data_styles,
				     this.o.metabolite_data,
				     this.o.metabolite_data_styles,
				     cobra_model_obj);
	    this.zoom_container.reset();
	} else {
	    // new map
	    this.map = new Map(svg, this.o.css, zoomed_sel,
			       this.zoom_container,
			       this.o.reaction_data,
			       this.o.reaction_data_styles,
			       this.o.metabolite_data,
			       this.o.metabolite_data_styles,
			       cobra_model_obj);
	}

	// set up the reaction input with complete.ly
	this.reaction_input = Input(this.o.selection, this.map, this.zoom_container);

	if (this.o.enable_editing) {
	    // set up the Brush
	    this.brush = new Brush(zoomed_sel, false, this.map, '.canvas-group');

	    // set up the modes
	    this._setup_modes(this.map, this.brush, this.zoom_container);

	    // start in zoom mode
	    this.zoom_mode();
	} else {
	    // turn off the behaviors
	    this.map.behavior.turn_everything_off();
	    this.map.canvas.toggle_resize(false);
	}
	
	// set up key manager
	var keys = this._get_keys(this.map, this.reaction_input, this.brush, this.o.enable_editing);
	this.map.key_manager.assigned_keys = keys;
	// tell the key manager about the reaction input
	this.map.key_manager.reaction_input = this.reaction_input;
	// make sure the key manager remembers all those changes
	this.map.key_manager.update();
	// turn it on/off
	this.map.key_manager.toggle(this.o.enable_keys);
	
	// set up menu and status bars
	if (this.o.enable_menu) {
	    this._setup_menu(this.o.selection, this.map, this.zoom_container, this.map.key_manager, keys,
			     this.o.enable_editing);
	}
	var status = this._setup_status(this.o.selection, this.map);

	// setup selection box
	if (this.o.map_data!==null) {
	    this.map.zoom_extent_canvas();
	} else {
	    if (this.o.starting_reaction!==null && cobra_model_obj!==null) {
		// Draw default reaction if no map is provided
		var size = this.zoom_container.get_size();
		var start_coords = { x: size.width / 2,
				     y: size.height / 4 };
		this.map.new_reaction_from_scratch(this.o.starting_reaction, start_coords);
		this.map.zoom_extent_nodes();
	    } else {
		this.map.zoom_extent_canvas();
	    }
	}

	// draw
	this.map.draw_everything();

	// run the load callback
	if (this.o.on_load!==null)
	    this.o.on_load();
    }
    function set_mode(mode) {
	this.reaction_input.toggle(mode=='build');
	this.brush.toggle(mode=='brush');
	this.zoom_container.toggle_zoom(mode=='zoom');
	this.map.canvas.toggle_resize(mode=='zoom');
	if (mode=='rotate') this.map.rotate_selected_nodes();
	this.callback_manager.run('set_mode', mode);
    }
    function build_mode() {
	this.set_mode('build');
	this.callback_manager.run('build_mode');
    }	
    function brush_mode() {
	this.set_mode('brush');
	this.callback_manager.run('brush_mode');
    }
    function zoom_mode() {
	this.set_mode('zoom');
	this.callback_manager.run('zoom_mode');
    }
    function rotate_mode() {
	this.set_mode('rotate');
	this.callback_manager.run('rotate_mode');
    }	
    function _setup_menu(selection, map, zoom_container, key_manager, keys,
			 enable_editing) {
	var menu = selection
		.append("span").attr('id', 'menu')
		.append("ul")
		.attr("class", "nav nav-pills");
	// map dropdown
	ui.dropdown_menu(menu, 'Map')
	    .button({ key: keys.save,
		      text: "Save as JSON (Ctrl s)" })
	    .button({ text: "Load map JSON (Ctrl o)",
		      input: { assign: key_manager.assigned_keys.load,
			       key: 'fn',
			       fn: load_map_for_file,
			       target: this }
		    })
	    .button({ key: keys.save_svg,
		      text: "Export as SVG (Ctrl Shift s)" })
	    .button({ key: keys.clear_map,
		      text: "Clear map" });
	// model dropdown
	ui.dropdown_menu(menu, 'Model')
	    .button({ text: 'Load COBRA model JSON (Ctrl m)',
		      input: { assign: key_manager.assigned_keys.load_model,
			       key: 'fn',
			       fn: load_model_for_file,
			       target: this }
		    });

	// data dropdown
	var data_menu = ui.dropdown_menu(menu, 'Data')
		.button({ input: { assign: key_manager.assigned_keys.load_reaction_data,
				   key: 'fn',
				   fn: load_reaction_data_for_file,
				   target: this },
			  text: "Load reaction data (Ctrl f)" })
		.button({ key: keys.clear_reaction_data,
			  text: "Clear reaction data" })
		.button({ input: { fn: load_metabolite_data_for_file,
				   target: this },
			  text: "Load metabolite data" })
		.button({ key: keys.clear_metabolite_data,
			  text: "Clear metabolite data" });
	
	// edit dropdown
	if (enable_editing) {	    
	    var edit_menu = ui.dropdown_menu(menu, 'Edit', true)	
		    .button({ key: keys.build_mode,
			      id: 'build-mode-menu-button',
			      text: "Build mode (/)" })
		    .button({ key: keys.zoom_mode,
			      id: 'zoom-mode-menu-button',
			      text: "Zoom + Pan mode (z)" })
		    .button({ key: keys.brush_mode,
			      id: 'brush-mode-menu-button',
			      text: "Select mode (v)" })
		    .button({ key: keys.rotate_mode,
			      id: 'rotate-mode-menu-button',
			      text: "Rotate mode (r)" })
		    .divider()
		    .button({ key: keys.delete,
			      // icon: "glyphicon glyphicon-trash",
			      text: "Delete (Ctrl del)" })
		    .button({ key: keys.undo, 
			      text: "Undo (Ctrl z)" })
		    .button({ key: keys.redo,
			      text: "Redo (Ctrl Shift z)" }) 
		    .button({ key: keys.make_primary,
			      text: "Make primary metabolite (p)" })
		    .button({ key: keys.cycle_primary,
			      text: "Cycle primary metabolite (c)" });
	}

	// view dropdown
	var view_menu = ui.dropdown_menu(menu, 'View', true)
		.button({ key: keys.zoom_in,
			  text: "Zoom in (Ctrl +)" })
		.button({ key: keys.zoom_out,
			  text: "Zoom out (Ctrl -)" })
		.button({ key: keys.extent_nodes,
			  //icon: "glyphicon glyphicon-resize-small",
			  text: "Zoom to nodes (Ctrl 0)"
			})
		.button({ key: keys.extent_canvas,
			  //icon: "glyphicon glyphicon-resize-full",
			  text: "Zoom to canvas (Ctrl 1)" });


	
	var button_panel = selection.append("ul")
		.attr("class", "nav nav-pills nav-stacked")
		.attr('id', 'button-panel');

	// mode buttons
	if (enable_editing) {
	    ui.radio_button_group(button_panel)
		.button({ key: keys.build_mode,
			  id: 'build-mode-button',
			  icon: "glyphicon glyphicon-plus",
			  tooltip: "Build mode (/)" })
		.button({ key: keys.zoom_mode,
			  id: 'zoom-mode-button',
			  icon: "glyphicon glyphicon-move",
			  tooltip: "Zoom + Pan mode (z)" })
		.button({ key: keys.brush_mode,
			  id: 'brush-mode-button',
			  icon: "glyphicon glyphicon-screenshot",
			  tooltip: "Select mode (v)" })
		.button({ key: keys.rotate_mode,
			  id: 'rotate-mode-button',
			  icon: "glyphicon glyphicon-repeat",
			  tooltip: "Rotate mode (r)" });
	}

	// buttons
	ui.individual_button(button_panel, { key: keys.zoom_in,
					     icon: "glyphicon glyphicon-zoom-in",
					     tooltip: "Zoom in (Ctrl +)" });
	ui.individual_button(button_panel, { key: keys.zoom_out,
					     icon: "glyphicon glyphicon-zoom-out",
					     tooltip: "Zoom out (Ctrl -)" });
	ui.individual_button(button_panel, { key: keys.extent_canvas,
					     icon: "glyphicon glyphicon-resize-full",
					     tooltip: "Zoom to canvas (Ctrl 1)" });

	// set up mode callbacks
	var select_menu_button = function(id) {
	    var ids = ['#build-mode-menu-button',
		       '#zoom-mode-menu-button',
		       '#brush-mode-menu-button',
		       '#rotate-mode-menu-button'];
	    for (var i=0, l=ids.length; i<l; i++) {
		var the_id = ids[i];
		d3.select(the_id)
		    .select('span')
		    .classed('glyphicon', the_id==id)
		    .classed('glyphicon-ok', the_id==id);
	    }
	};
	this.callback_manager.set('build_mode', function() {
	    $('#build-mode-button').button('toggle');
	    select_menu_button('#build-mode-menu-button');
	});
	this.callback_manager.set('zoom_mode', function() {
	    $('#zoom-mode-button').button('toggle');
	    select_menu_button('#zoom-mode-menu-button');
	});
	this.callback_manager.set('brush_mode', function() {
	    $('#brush-mode-button').button('toggle');
	    select_menu_button('#brush-mode-menu-button');
	});
	this.callback_manager.set('rotate_mode', function() {
	    $('#rotate-mode-button').button('toggle');
	    select_menu_button('#rotate-mode-menu-button');
	});


	// var b = new_button(sel, keys.toggle_beziers, "Hide control points (b)", 'bezier-button');
	// map.callback_manager
	//     .set('toggle_beziers.button', function(on_off) {
	// 	b.text((on_off ? 'Hide' : 'Show') + ' control points (b)');
	//     });

	// new_button(sel, keys.direction_arrow_left, "←");
	// new_button(sel, keys.direction_arrow_up, "↑");
	// new_button(sel, keys.direction_arrow_down, "↓");
	// new_button(sel, keys.direction_arrow_right, "→");

	// definitions
	function load_map_for_file(error, map_data) {
	    if (error) console.warn(error);
	    this.o.map_data = map_data;
	    this.reload_builder();
	}
	function load_model_for_file(error, data) {
	    if (error) console.warn(error);
	    var cobra_model_obj = CobraModel(data);
	    this.map.set_model(cobra_model_obj);
	    this.reaction_input.toggle(false);
	}
	function load_reaction_data_for_file(error, data) {
	    if (error) console.warn(error);
	    this.map.set_reaction_data(data);
	}
	function load_metabolite_data_for_file(error, data) {
	    if (error) console.warn(error);
	    this.map.set_metabolite_data(data);
	}
    }

    function _setup_status(selection, map) {
	var status_bar = selection.append("div").attr("id", "status");
	map.callback_manager.set('set_status', function(status) {
	    status_bar.text(status);
	});
	return status_bar;
    }

    function _setup_modes(map, brush, zoom_container) {
	// set up zoom+pan and brush modes
	var was_enabled = {};
	map.callback_manager.set('start_rotation', function() {
	    was_enabled.brush = brush.enabled;
	    brush.toggle(false);
	    was_enabled.zoom = zoom_container.zoom_on;
	    zoom_container.toggle_zoom(false);
	    was_enabled.node_click = map.behavior.node_click!=null;
	    map.behavior.toggle_node_click(false);
	});
	map.callback_manager.set('end_rotation', function() {
	    brush.toggle(was_enabled.brush);
	    zoom_container.toggle_zoom(was_enabled.zoom);
	    map.behavior.toggle_node_click(was_enabled.node_click);
	    was_enabled = {};
	});
    }

    function _get_keys(map, input, brush, enable_editing) {
	var keys = {
            save: { key: 83, modifiers: { control: true }, // ctrl-s
		    target: map,
		    fn: map.save },
            save_svg: { key: 83, modifiers: { control: true, shift: true },
			target: map,
			fn: map.save_svg },
            load: { key: 79, modifiers: { control: true }, // ctrl-o
		    fn: null }, // defined by button
	    clear_map: { target: map,
			 fn: function() { this.clear_map(); }},
            load_model: { key: 77, modifiers: { control: true }, // ctrl-m
			  fn: null }, // defined by button
	    load_reaction_data: { key: 70, modifiers: { control: true }, // ctrl-f
				  fn: null }, // defined by button
	    clear_reaction_data: { target: map,
				   fn: function() { this.set_reaction_data(null); }},
	    load_metabolite_data: { key: 70, modifiers: { control: true }, // ctrl-m
				    fn: null }, // defined by button
	    clear_metabolite_data: { target: map,
				     fn: function() { this.set_metabolite_data(null); }},
	    zoom_in: { key: 187, modifiers: { control: true }, // ctrl +
		       target: this.zoom_container,
		       fn: this.zoom_container.zoom_in },
	    zoom_out: { key: 189, modifiers: { control: true }, // ctrl -
			target: this.zoom_container,
			fn: this.zoom_container.zoom_out },
	    extent_nodes: { key: 48, modifiers: { control: true }, // ctrl-0
			    target: map,
			    fn: map.zoom_extent_nodes },
	    extent_canvas: { key: 49, modifiers: { control: true }, // ctrl-1
			     target: map,
			     fn: map.zoom_extent_canvas }
	};
	if (enable_editing) {
	    utils.extend(keys, {
		build_mode: { key: 191, // forward slash '/'
			      target: this,
			      fn: this.build_mode },
		zoom_mode: { key: 90, // z 
			     target: this,
			     fn: this.zoom_mode,
			     ignore_with_input: true },
		brush_mode: { key: 86, // v
			      target: this,
			      fn: this.brush_mode,
			      ignore_with_input: true },
		rotate_mode: { key: 82, // r
			       target: this,
			       fn: this.rotate_mode,
			       ignore_with_input: true },
		toggle_beziers: { key: 66,
				  target: map,
				  fn: map.toggle_beziers,
				  ignore_with_input: true  }, // b
		delete: { key: 8, modifiers: { control: true }, // ctrl-backspace
			  target: map,
			  fn: map.delete_selected,
			  ignore_with_input: true },
		delete_del: { key: 46, modifiers: { control: true }, // ctrl-del
			      target: map,
			      fn: map.delete_selected,
			      ignore_with_input: true },
		make_primary: { key: 80, // p
				target: map,
				fn: map.make_selected_node_primary,
				ignore_with_input: true },
		cycle_primary: { key: 67, // c
				 target: map,
				 fn: map.cycle_primary_node,
				 ignore_with_input: true },
		direction_arrow_right: { key: 39, // right
					 target: map.direction_arrow,
					 fn: map.direction_arrow.right,
					 ignore_with_input: true },
		direction_arrow_down: { key: 40, // down
					target: map.direction_arrow,
					fn: map.direction_arrow.down,
					ignore_with_input: true },
		direction_arrow_left: { key: 37, // left
					target: map.direction_arrow,
					fn: map.direction_arrow.left,
					ignore_with_input: true },
		direction_arrow_up: { key: 38, // up
				      target: map.direction_arrow,
				      fn: map.direction_arrow.up,
				      ignore_with_input: true },
		undo: { key: 90, modifiers: { control: true },
			target: map.undo_stack,
			fn: map.undo_stack.undo },
		redo: { key: 90, modifiers: { control: true, shift: true },
			target: map.undo_stack,
			fn: map.undo_stack.redo }
	    });
	}
	return keys;
    }
});

define('DataMenu',["utils"], function(utils) {
    return function(options) {
        var o = utils.set_options(options, {
            selection: null,
            getdatafiles: null,
            datafiles: null,
            update_callback: null,
	    target: null});

	if (o.selection===null)
	    throw Error('No selection provided for DataMenu');

        // setup dropdown menu
        // Append menu if it doesn't exist
        var menu = o.selection.select('.data-menu');
        if (menu.empty()) {
            menu = o.selection.append('div')
                .attr('class','data-menu');
        }
        var select_sel = menu.append('form')
            .append('select').attr('class','dropdown-menu');

        if (o.getdatafiles) {
            if (o.datafiles) {
                console.warn('DataMenu: getdatafiles option overrides datafiles');
            }
            d3.json(o.getdatafiles, function(error, d) {
                // returns json object:  { data: [file0, file1, ...] }
                if (error) {
                    return console.warn(error);
                } else {
                    load_with_files(o.target, d.data, select_sel, o.update_callback, o.selection);
                }
                return null;
            });
        } else if (o.datafiles) {
            load_with_files(o.target, o.datafiles, select_sel, o.update_callback, o.selection);
        } else {
            console.warn('DataMenu: No datafiles given');
        }

        return { update: update };

        // definitions
        function load_with_files(t, files, select_sel, update_callback, selection) {

            //when it changes
            select_sel.node().addEventListener("change", function() {
                load_datafile(t, this.value, selection, update_callback);
            }, false);

            var file = files[0];

            update(files, select_sel);
            load_datafile(t, file, selection, update_callback);
        };
        function load_datafile(t, this_file, selection, callback) {
            utils.load_the_file(t, this_file, function(error, data) {
                if (error) {
                    return console.warn(error);
                    selection.append('error loading');
                    o.data = null;
                } else {
                    o.data = data;
                    if (callback) {
                        callback(data);
                    }
                }
            });
        };

        function update(list, select_sel) {
            // update select element with d3 selection /select_sel/ to have options
            // given by /list/
            // TODO remove paths from file list
            select_sel.selectAll(".menu-option")
                .data(list)
                .enter()
                .append('option')
                .attr('value', function (d) { return d; } )
                .text(function (d) { return d; } );
            // TODO set value to default_filename_index
            select_sel.node().focus();
        };

        function get_data() {
            return o.data;
        };
    };
});

define('main',["Builder", "Map", "Behavior", "KeyManager", "DataMenu", "UndoStack", "CobraModel", "utils"],
       function(bu, mp, bh, km, dm, us, cm, ut) {
           return { Builder: bu,
		    Map: mp,
		    Behavior: bh,
		    KeyManager: km,
		    DataMenu: dm,
		    UndoStack: us,
		    CobraModel: cm,
		    utils: ut };
       });

    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return require('main');
}));