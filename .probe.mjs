var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/react/cjs/react.production.js
var require_react_production = __commonJS({
  "node_modules/react/cjs/react.production.js"(exports) {
    "use strict";
    var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
    var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
    var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
    var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
    var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
    var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
    var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
    var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
    var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
    var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
    var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
    var REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity");
    var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
    function getIteratorFn(maybeIterable) {
      if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    var ReactNoopUpdateQueue = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    };
    var assign = Object.assign;
    var emptyObject = {};
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables."
        );
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    function ComponentDummy() {
    }
    ComponentDummy.prototype = Component.prototype;
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
    pureComponentPrototype.constructor = PureComponent;
    assign(pureComponentPrototype, Component.prototype);
    pureComponentPrototype.isPureReactComponent = true;
    var isArrayImpl = Array.isArray;
    function noop() {
    }
    var ReactSharedInternals = { H: null, A: null, T: null, S: null };
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function ReactElement(type, key, props) {
      var refProp = props.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== refProp ? refProp : null,
        props
      };
    }
    function cloneAndReplaceKey(oldElement, newKey) {
      return ReactElement(oldElement.type, newKey, oldElement.props);
    }
    function isValidElement(object) {
      return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    var userProvidedKeyEscapeRegex = /\/+/g;
    function getElementKey(element, index) {
      return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
    }
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
            function(fulfilledValue) {
              "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
            },
            function(error) {
              "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
            }
          )), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if ("undefined" === type || "boolean" === type) children = null;
      var invokeCallback = false;
      if (null === children) invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(
                  invokeCallback(children._payload),
                  array,
                  escapedPrefix,
                  nameSoFar,
                  callback
                );
            }
        }
      if (invokeCallback)
        return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
          return c;
        })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
          callback,
          escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
            userProvidedKeyEscapeRegex,
            "$&/"
          ) + "/") + invokeCallback
        )), array.push(callback)), 1;
      invokeCallback = 0;
      var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i = 0; i < children.length; i++)
          nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if (i = getIteratorFn(children), "function" === typeof i)
        for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if ("object" === type) {
        if ("function" === typeof children.then)
          return mapIntoArray(
            resolveThenable(children),
            array,
            escapedPrefix,
            nameSoFar,
            callback
          );
        array = String(children);
        throw Error(
          "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
        );
      }
      return invokeCallback;
    }
    function mapChildren(children, func, context) {
      if (null == children) return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    function lazyInitializer(payload) {
      if (-1 === payload._status) {
        var ctor = payload._result;
        ctor = ctor();
        ctor.then(
          function(moduleObject) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 1, payload._result = moduleObject;
          },
          function(error) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 2, payload._result = error;
          }
        );
        -1 === payload._status && (payload._status = 0, payload._result = ctor);
      }
      if (1 === payload._status) return payload._result.default;
      throw payload._result;
    }
    var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    };
    var Children = {
      map: mapChildren,
      forEach: function(children, forEachFunc, forEachContext) {
        mapChildren(
          children,
          function() {
            forEachFunc.apply(this, arguments);
          },
          forEachContext
        );
      },
      count: function(children) {
        var n = 0;
        mapChildren(children, function() {
          n++;
        });
        return n;
      },
      toArray: function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      },
      only: function(children) {
        if (!isValidElement(children))
          throw Error(
            "React.Children.only expected to receive a single React element child."
          );
        return children;
      }
    };
    exports.Activity = REACT_ACTIVITY_TYPE;
    exports.Children = Children;
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(size) {
        return ReactSharedInternals.H.useMemoCache(size);
      }
    };
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cacheSignal = function() {
      return null;
    };
    exports.cloneElement = function(element, config, children) {
      if (null === element || void 0 === element)
        throw Error(
          "The argument must be a React element, but you passed " + element + "."
        );
      var props = assign({}, element.props), key = element.key;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
      var propName = arguments.length - 2;
      if (1 === propName) props.children = children;
      else if (1 < propName) {
        for (var childArray = Array(propName), i = 0; i < propName; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      return ReactElement(element.type, key, props);
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      var propName, props = {}, key = null;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (1 === childrenLength) props.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          void 0 === props[propName] && (props[propName] = childrenLength[propName]);
      return ReactElement(type, key, props);
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(render) {
      return { $$typeof: REACT_FORWARD_REF_TYPE, render };
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      return {
        $$typeof: REACT_LAZY_TYPE,
        _payload: { _status: -1, _result: ctor },
        _init: lazyInitializer
      };
    };
    exports.memo = function(type, compare) {
      return {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: void 0 === compare ? null : compare
      };
    };
    exports.startTransition = function(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
      } catch (error) {
        reportGlobalError(error);
      } finally {
        null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    };
    exports.unstable_useCacheRefresh = function() {
      return ReactSharedInternals.H.useCacheRefresh();
    };
    exports.use = function(usable) {
      return ReactSharedInternals.H.use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return ReactSharedInternals.H.useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return ReactSharedInternals.H.useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      return ReactSharedInternals.H.useContext(Context);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(value, initialValue) {
      return ReactSharedInternals.H.useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, deps) {
      return ReactSharedInternals.H.useEffect(create, deps);
    };
    exports.useEffectEvent = function(callback) {
      return ReactSharedInternals.H.useEffectEvent(callback);
    };
    exports.useId = function() {
      return ReactSharedInternals.H.useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
      return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
      return ReactSharedInternals.H.useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
      return ReactSharedInternals.H.useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
      return ReactSharedInternals.H.useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return ReactSharedInternals.H.useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return ReactSharedInternals.H.useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return ReactSharedInternals.H.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
      );
    };
    exports.useTransition = function() {
      return ReactSharedInternals.H.useTransition();
    };
    exports.version = "19.2.8";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    "production" !== process.env.NODE_ENV && (function() {
      function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              info[0],
              info[1]
            );
          }
        });
      }
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable)
          return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          callerName,
          publicInstance
        ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
      }
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function ComponentDummy() {
      }
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function noop() {
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(
          oldElement.type,
          newKey,
          oldElement.props,
          oldElement._owner,
          oldElement._debugStack,
          oldElement._debugTask
        );
        oldElement._store && (newKey._store.validated = oldElement._store.validated);
        return newKey;
      }
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback) {
          invokeCallback = children;
          callback = callback(invokeCallback);
          var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
          isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
            return c;
          })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + childKey
          ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
          return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (i === children.entries && (didWarnAboutMaps || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), didWarnAboutMaps = true), children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ioInfo = payload._ioInfo;
          null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
          ioInfo = payload._result;
          var thenable = ioInfo();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 1;
                payload._result = moduleObject;
                var _ioInfo = payload._ioInfo;
                null != _ioInfo && (_ioInfo.end = performance.now());
                void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
              }
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 2;
                payload._result = error;
                var _ioInfo2 = payload._ioInfo;
                null != _ioInfo2 && (_ioInfo2.end = performance.now());
                void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            }
          );
          ioInfo = payload._ioInfo;
          if (null != ioInfo) {
            ioInfo.value = thenable;
            var displayName = thenable.displayName;
            "string" === typeof displayName && (ioInfo.name = displayName);
          }
          -1 === payload._status && (payload._status = 0, payload._result = thenable);
        }
        if (1 === payload._status)
          return ioInfo = payload._result, void 0 === ioInfo && console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
            ioInfo
          ), "default" in ioInfo || console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
            ioInfo
          ), ioInfo.default;
        throw payload._result;
      }
      function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error(
          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
        );
        return dispatcher;
      }
      function releaseAsyncTransition() {
        ReactSharedInternals.asyncTransitions--;
      }
      function enqueueTask(task) {
        if (null === enqueueTaskImpl)
          try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(
              module,
              "timers"
            ).setImmediate;
          } catch (_err) {
            enqueueTaskImpl = function(callback) {
              false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var channel = new MessageChannel();
              channel.port1.onmessage = callback;
              channel.port2.postMessage(void 0);
            };
          }
        return enqueueTaskImpl(task);
      }
      function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
      }
      function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        );
        actScopeDepth = prevActScopeDepth;
      }
      function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
        var queue = ReactSharedInternals.actQueue;
        if (null !== queue)
          if (0 !== queue.length)
            try {
              flushActQueue(queue);
              enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
              });
              return;
            } catch (error) {
              ReactSharedInternals.thrownErrors.push(error);
            }
          else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
      }
      function flushActQueue(queue) {
        if (!isFlushing) {
          isFlushing = true;
          var i = 0;
          try {
            for (; i < queue.length; i++) {
              var callback = queue[i];
              do {
                ReactSharedInternals.didUsePromise = false;
                var continuation = callback(false);
                if (null !== continuation) {
                  if (ReactSharedInternals.didUsePromise) {
                    queue[i] = callback;
                    queue.splice(0, i);
                    return;
                  }
                  callback = continuation;
                } else break;
              } while (1);
            }
            queue.length = 0;
          } catch (error) {
            queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
          } finally {
            isFlushing = false;
          }
        }
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function(publicInstance) {
          warnNoop(publicInstance, "forceUpdate");
        },
        enqueueReplaceState: function(publicInstance) {
          warnNoop(publicInstance, "replaceState");
        },
        enqueueSetState: function(publicInstance) {
          warnNoop(publicInstance, "setState");
        }
      }, assign = Object.assign, emptyObject = {};
      Object.freeze(emptyObject);
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      var deprecatedAPIs = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (fnName in deprecatedAPIs)
        deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
      ComponentDummy.prototype = Component.prototype;
      deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
      deprecatedAPIs.constructor = PureComponent;
      assign(deprecatedAPIs, Component.prototype);
      deprecatedAPIs.isPureReactComponent = true;
      var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: false,
        didScheduleLegacyUpdate: false,
        didUsePromise: false,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      deprecatedAPIs = {
        react_stack_bottom_frame: function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(
        deprecatedAPIs,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
          return queueMicrotask(callback);
        });
      } : enqueueTask;
      deprecatedAPIs = Object.freeze({
        __proto__: null,
        c: function(size) {
          return resolveDispatcher().useMemoCache(size);
        }
      });
      var fnName = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Activity = REACT_ACTIVITY_TYPE;
      exports.Children = fnName;
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = deprecatedAPIs;
      exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
        try {
          var result = callback();
        } catch (error) {
          ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
          var thenable = result;
          queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          });
          return {
            then: function(resolve, reject) {
              didAwaitActCall = true;
              thenable.then(
                function(returnValue) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  if (0 === prevActScopeDepth) {
                    try {
                      flushActQueue(queue), enqueueTask(function() {
                        return recursivelyFlushAsyncActWork(
                          returnValue,
                          resolve,
                          reject
                        );
                      });
                    } catch (error$0) {
                      ReactSharedInternals.thrownErrors.push(error$0);
                    }
                    if (0 < ReactSharedInternals.thrownErrors.length) {
                      var _thrownError = aggregateErrors(
                        ReactSharedInternals.thrownErrors
                      );
                      ReactSharedInternals.thrownErrors.length = 0;
                      reject(_thrownError);
                    }
                  } else resolve(returnValue);
                },
                function(error) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                    ReactSharedInternals.thrownErrors
                  ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                }
              );
            }
          };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
          then: function(resolve, reject) {
            didAwaitActCall = true;
            0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
              return recursivelyFlushAsyncActWork(
                returnValue$jscomp$0,
                resolve,
                reject
              );
            })) : resolve(returnValue$jscomp$0);
          }
        };
      };
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cacheSignal = function() {
        return null;
      };
      exports.captureOwnerStack = function() {
        var getCurrentStack = ReactSharedInternals.getCurrentStack;
        return null === getCurrentStack ? null : getCurrentStack();
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
          var JSCompiler_inline_result;
          a: {
            if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
              config,
              "ref"
            ).get) && JSCompiler_inline_result.isReactWarning) {
              JSCompiler_inline_result = false;
              break a;
            }
            JSCompiler_inline_result = void 0 !== config.ref;
          }
          JSCompiler_inline_result && (owner = getOwner());
          hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
          for (propName in config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          JSCompiler_inline_result = Array(propName);
          for (var i = 0; i < propName; i++)
            JSCompiler_inline_result[i] = arguments[i + 2];
          props.children = JSCompiler_inline_result;
        }
        props = ReactElement(
          element.type,
          key,
          props,
          owner,
          element._debugStack,
          element._debugTask
        );
        for (key = 2; key < arguments.length; key++)
          validateChildKeys(arguments[key]);
        return props;
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        for (var i = 2; i < arguments.length; i++)
          validateChildKeys(arguments[i]);
        i = {};
        var key = null;
        if (null != config)
          for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
            childArray[_i] = arguments[_i + 2];
          Object.freeze && Object.freeze(childArray);
          i.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === i[propName] && (i[propName] = childrenLength[propName]);
        key && defineKeyPropWarningGetter(
          i,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return ReactElement(
          type,
          key,
          i,
          getOwner(),
          propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.createRef = function() {
        var refObject = { current: null };
        Object.seal(refObject);
        return refObject;
      };
      exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : "function" !== typeof render ? console.error(
          "forwardRef requires a render function but was given %s.",
          null === render ? "null" : typeof render
        ) : 0 !== render.length && 2 !== render.length && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        );
        null != render && null != render.defaultProps && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
        Object.defineProperty(elementType, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
          }
        });
        return elementType;
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        ctor = { _status: -1, _result: ctor };
        var lazyType = {
          $$typeof: REACT_LAZY_TYPE,
          _payload: ctor,
          _init: lazyInitializer
        }, ioInfo = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        ctor._ioInfo = ioInfo;
        lazyType._debugInfo = [{ awaited: ioInfo }];
        return lazyType;
      };
      exports.memo = function(type, compare) {
        null == type && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          null === type ? "null" : typeof type
        );
        compare = {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
          }
        });
        return compare;
      };
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition._updatedFibers = /* @__PURE__ */ new Set();
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      };
      exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
      };
      exports.use = function(usable) {
        return resolveDispatcher().use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(
          action,
          initialState,
          permalink
        );
      };
      exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        );
        return dispatcher.useContext(Context);
      };
      exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
      };
      exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useEffect(create, deps);
      };
      exports.useEffectEvent = function(callback) {
        return resolveDispatcher().useEffectEvent(callback);
      };
      exports.useId = function() {
        return resolveDispatcher().useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return resolveDispatcher().useTransition();
      };
      exports.version = "19.2.8";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production();
    } else {
      module.exports = require_react_development();
    }
  }
});

// src/engine/audio/lofi.ts
var LOFI_TRACKS = [
  {
    name: "KITCHEN RADIO",
    bpm: 68,
    // Fmaj7 → Em7 → Dm7 → Cmaj7 — a tired, warm descent
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59]
    ],
    beatsPerChord: 8,
    cutoff: 900,
    percussion: true,
    crackle: 1,
    melody: 0.45
  },
  {
    name: "RAINY BALCONY",
    bpm: 58,
    // Am7 → Fmaj7 → Cmaj7 → G7
    chords: [
      [45, 48, 52, 55],
      [41, 45, 48, 52],
      [48, 52, 55, 59],
      [43, 47, 50, 53]
    ],
    beatsPerChord: 8,
    cutoff: 700,
    percussion: false,
    crackle: 1.8,
    melody: 0.3
  },
  {
    name: "NIGHT TRAM",
    bpm: 62,
    // Dm7 → G7 → Cmaj7 → Am7
    chords: [
      [50, 53, 57, 60],
      [43, 47, 50, 53],
      [48, 52, 55, 59],
      [45, 48, 52, 55]
    ],
    beatsPerChord: 8,
    cutoff: 850,
    percussion: true,
    crackle: 1.2,
    melody: 0.5
  },
  {
    name: "WARM MILK",
    bpm: 54,
    // Cmaj7 → Am7 → Fmaj7 → G7, very slow, darkest tone
    chords: [
      [48, 52, 55, 59],
      [45, 48, 52, 55],
      [41, 45, 48, 52],
      [43, 47, 50, 53]
    ],
    beatsPerChord: 12,
    cutoff: 620,
    percussion: false,
    crackle: 1.4,
    melody: 0.2
  }
];
var midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
var CROSSFADE_S = 2.5;
var LOOKAHEAD_S = 0.6;
var TICK_MS = 180;
function buildReverbImpulse(ctx, seconds = 1.8, decay = 3.2) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
  }
  return buf;
}
var TrackVoice = class {
  ctx;
  track;
  bus;
  filter;
  wobble;
  delay;
  timer = null;
  nextChordTime = 0;
  nextBeatTime = 0;
  chordIndex = 0;
  beatIndex = 0;
  stopped = false;
  constructor(ctx, track, destination, reverb) {
    this.ctx = ctx;
    this.track = track;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = track.cutoff;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.bus);
    this.wobble = ctx.createOscillator();
    this.wobble.frequency.value = 0.31;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 35;
    this.wobble.connect(wobbleGain);
    wobbleGain.connect(this.filter.detune);
    this.wobble.start();
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 60 / track.bpm * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.bus);
    this.bus.connect(destination);
    const send = ctx.createGain();
    send.gain.value = 0.4;
    this.bus.connect(send);
    send.connect(reverb);
  }
  start() {
    const now = this.ctx.currentTime;
    this.nextChordTime = now + 0.1;
    this.nextBeatTime = now + 0.1;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }
  fadeIn() {
    const g = this.bus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1, now + CROSSFADE_S);
  }
  /** Fade out, then tear down. */
  fadeOutAndStop() {
    const g = this.bus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + CROSSFADE_S);
    window.setTimeout(() => this.stop(), (CROSSFADE_S + 0.2) * 1e3);
  }
  stop() {
    this.stopped = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    window.setTimeout(() => {
      this.wobble.stop();
      this.filter.disconnect();
      this.delay.disconnect();
      this.bus.disconnect();
    }, 100);
  }
  schedule() {
    if (this.stopped) return;
    const ctx = this.ctx;
    const track = this.track;
    const beatS = 60 / track.bpm;
    const chordS = beatS * track.beatsPerChord;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    while (this.nextChordTime < horizon) {
      const chord = track.chords[this.chordIndex % track.chords.length];
      this.playChord(chord, this.nextChordTime, chordS);
      if (Math.random() < track.melody) {
        this.playPhrase(chord, this.nextChordTime + chordS * (0.25 + Math.random() * 0.35), beatS);
      }
      this.chordIndex += 1;
      this.nextChordTime += chordS;
    }
    if (track.percussion) {
      while (this.nextBeatTime < horizon) {
        const beatInBar = this.beatIndex % 4;
        if (beatInBar === 0) this.kick(this.nextBeatTime, 1);
        if (beatInBar === 1) this.kick(this.nextBeatTime + beatS * 0.62, 0.4);
        if (beatInBar === 2) this.rim(this.nextBeatTime);
        this.beatIndex += 1;
        this.nextBeatTime += beatS;
      }
    }
  }
  playChord(midis, at, holdS) {
    const { ctx } = this;
    const attack = Math.min(1.6, holdS * 0.25);
    const release = Math.min(2.2, holdS * 0.35);
    midis.forEach((m, i) => {
      for (const detune of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = midiHz(m);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.045, at + attack);
        g.gain.setValueAtTime(0.045, at + holdS - release);
        g.gain.linearRampToValueAtTime(0, at + holdS + 0.3);
        const pan = ctx.createStereoPanner();
        pan.pan.value = (i % 2 === 0 ? -1 : 1) * (0.12 + 0.1 * (detune > 0 ? 1 : 0));
        osc.connect(g);
        g.connect(pan);
        pan.connect(this.filter);
        osc.start(at);
        osc.stop(at + holdS + 0.5);
      }
    });
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.value = midiHz(midis[0] - 12);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, at);
    bg.gain.linearRampToValueAtTime(0.11, at + attack * 0.7);
    bg.gain.setValueAtTime(0.11, at + holdS - release);
    bg.gain.linearRampToValueAtTime(0, at + holdS + 0.2);
    bass.connect(bg);
    bg.connect(this.filter);
    bass.start(at);
    bass.stop(at + holdS + 0.4);
  }
  /** A tiny wandering phrase — 2–3 soft sines from the chord, echoed. */
  playPhrase(chord, at, beatS) {
    const { ctx } = this;
    const notes = 2 + Math.floor(Math.random() * 2);
    let t = at;
    for (let i = 0; i < notes; i++) {
      const m = chord[Math.floor(Math.random() * chord.length)] + 12;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = midiHz(m);
      osc.detune.value = Math.random() * 8 - 4;
      const g = ctx.createGain();
      const len = beatS * (0.8 + Math.random() * 0.6);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.05);
      g.gain.exponentialRampToValueAtTime(8e-4, t + len);
      osc.connect(g);
      g.connect(this.filter);
      g.connect(this.delay);
      osc.start(t);
      osc.stop(t + len + 0.1);
      t += beatS * (0.75 + (Math.random() < 0.4 ? 0.75 : 0));
    }
  }
  kick(at, strength) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * strength, at);
    g.gain.exponentialRampToValueAtTime(1e-3, at + 0.22);
    osc.connect(g);
    g.connect(this.bus);
    osc.start(at);
    osc.stop(at + 0.25);
  }
  rim(at) {
    const { ctx } = this;
    const len = 0.03;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.bus);
    src.start(at);
  }
};
var LofiPlayer = class {
  ctx = null;
  master = null;
  reverb = null;
  crackleGain = null;
  voice = null;
  trackIndex_;
  _volume;
  _playing = false;
  listeners = /* @__PURE__ */ new Set();
  constructor() {
    this.trackIndex_ = Number(localStorage.getItem("lofi.track") ?? 0) % LOFI_TRACKS.length;
    const stored = Number(localStorage.getItem("lofi.volume"));
    this._volume = Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.5;
  }
  // --- observable state ------------------------------------------------------
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn();
  }
  get playing() {
    return this._playing;
  }
  get volume() {
    return this._volume;
  }
  /** Which slot is playing, so a deck can show 2/4 and highlight the right name. */
  get trackIndex() {
    return this.trackIndex_;
  }
  get trackCount() {
    return LOFI_TRACKS.length;
  }
  get trackNames() {
    return LOFI_TRACKS.map((t) => t.name);
  }
  get track() {
    return LOFI_TRACKS[this.trackIndex_];
  }
  /** Shared audio graph for sibling services (ambience, sfx). Unlock first. */
  get graph() {
    return this.ctx && this.master ? { ctx: this.ctx, master: this.master } : null;
  }
  // --- lifecycle ----------------------------------------------------------------
  /** Call from a user gesture: creates/resumes the AudioContext. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = buildReverbImpulse(this.ctx);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.32;
      this.reverb.connect(wet);
      wet.connect(this.master);
      this.startCrackle();
      this.emit();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }
  play() {
    this.unlock();
    if (this._playing || !this.ctx || !this.master || !this.reverb) return;
    this._playing = true;
    this.voice = new TrackVoice(this.ctx, this.track, this.master, this.reverb);
    this.voice.start();
    this.voice.fadeIn();
    this.setCrackle(this.track.crackle);
    this.emit();
  }
  pause() {
    if (!this._playing) return;
    this._playing = false;
    this.voice?.fadeOutAndStop();
    this.voice = null;
    this.setCrackle(0);
    this.emit();
  }
  toggle() {
    if (this._playing) this.pause();
    else this.play();
  }
  next(step = 1) {
    this.trackIndex_ = (this.trackIndex_ + step + LOFI_TRACKS.length) % LOFI_TRACKS.length;
    localStorage.setItem("lofi.track", String(this.trackIndex_));
    if (this._playing && this.ctx && this.master && this.reverb) {
      this.voice?.fadeOutAndStop();
      this.voice = new TrackVoice(this.ctx, this.track, this.master, this.reverb);
      this.voice.start();
      this.voice.fadeIn();
      this.setCrackle(this.track.crackle);
    }
    this.emit();
  }
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem("lofi.volume", String(this._volume));
    if (this.master && this.ctx) {
      const g = this.master.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this._volume, now + 0.15);
    }
    this.emit();
  }
  // --- vinyl bed --------------------------------------------------------------------
  startCrackle() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const seconds = 3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 4e-5) {
        data[i] = (Math.random() * 2 - 1) * 0.6;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3400;
    bp.Q.value = 0.5;
    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0;
    src.connect(bp);
    bp.connect(this.crackleGain);
    this.crackleGain.connect(this.master);
    src.start();
  }
  setCrackle(mult) {
    if (!this.crackleGain || !this.ctx) return;
    const g = this.crackleGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.5 * mult, now + CROSSFADE_S);
  }
};
var lofiPlayer = new LofiPlayer();

// src/engine/audio/ambience.ts
var FADE_S = 1.5;
function noiseSource(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.02) * 0.996;
    data[i] = brown * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}
function tone(ctx, hz, gainValue, out) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.value = gainValue;
  osc.connect(g);
  g.connect(out);
  osc.start();
  return osc;
}
function scheduleDrips(ctx, bus, everyMs) {
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.31;
  const fb = ctx.createGain();
  fb.gain.value = 0.45;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(bus);
  let timer = 0;
  const drop = () => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(1400 + Math.random() * 800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(1e-3, t + 0.08);
    osc.connect(g);
    g.connect(delay);
    osc.start(t);
    osc.stop(t + 0.1);
    timer = window.setTimeout(drop, everyMs[0] + Math.random() * (everyMs[1] - everyMs[0]));
  };
  timer = window.setTimeout(drop, 2e3);
  return () => window.clearTimeout(timer);
}
function scheduleBirds(ctx, bus) {
  let timer = 0;
  const chirp = () => {
    const t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const at = t + i * (0.09 + Math.random() * 0.06);
      const osc = ctx.createOscillator();
      const base = 2800 + Math.random() * 1200;
      osc.frequency.setValueAtTime(base, at);
      osc.frequency.exponentialRampToValueAtTime(base * 1.4, at + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, at);
      g.gain.exponentialRampToValueAtTime(1e-3, at + 0.07);
      osc.connect(g);
      g.connect(bus);
      osc.start(at);
      osc.stop(at + 0.1);
    }
    timer = window.setTimeout(chirp, 4e3 + Math.random() * 9e3);
  };
  timer = window.setTimeout(chirp, 1500);
  return () => window.clearTimeout(timer);
}
function scheduleCarPasses(ctx, bus) {
  let timer = 0;
  const pass = () => {
    const t = ctx.currentTime;
    const n = noiseSource(ctx, 4);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(420, t + 2);
    lp.frequency.linearRampToValueAtTime(160, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(0.35, t + 2);
    g.gain.linearRampToValueAtTime(1e-4, t + 4.2);
    n.connect(lp);
    lp.connect(g);
    g.connect(bus);
    n.start(t);
    n.stop(t + 4.5);
    timer = window.setTimeout(pass, 12e3 + Math.random() * 18e3);
  };
  timer = window.setTimeout(pass, 6e3);
  return () => window.clearTimeout(timer);
}
function scheduleScanner(ctx, bus) {
  let timer = 0;
  const beep = () => {
    const t = ctx.currentTime;
    for (const at of [0, 0.14]) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 1860;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.03, t + at);
      g.gain.exponentialRampToValueAtTime(1e-3, t + at + 0.07);
      osc.connect(g);
      g.connect(bus);
      osc.start(t + at);
      osc.stop(t + at + 0.1);
    }
    timer = window.setTimeout(beep, 6e3 + Math.random() * 1e4);
  };
  timer = window.setTimeout(beep, 3e3);
  return () => window.clearTimeout(timer);
}
function scheduleDoorChime(ctx, bus) {
  let timer = 0;
  const ding = () => {
    const t = ctx.currentTime;
    for (const [at, hz] of [
      [0, 987.8],
      [0.18, 784]
    ]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.028, t + at);
      g.gain.exponentialRampToValueAtTime(1e-3, t + at + 0.5);
      osc.connect(g);
      g.connect(bus);
      osc.start(t + at);
      osc.stop(t + at + 0.55);
    }
    timer = window.setTimeout(ding, 18e3 + Math.random() * 24e3);
  };
  timer = window.setTimeout(ding, 9e3);
  return () => window.clearTimeout(timer);
}
function buildBed(ctx, name, out) {
  if (name === "none") return null;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(out);
  const stops = [];
  if (name === "room") {
    const noise = noiseSource(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    noise.start();
    const hum = tone(ctx, 50, 0.05, bus);
    stops.push(() => {
      noise.stop();
      hum.stop();
    });
  }
  if (name === "street") {
    const noise = noiseSource(ctx, 3);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    noise.start();
    const wind = ctx.createBiquadFilter();
    wind.type = "bandpass";
    wind.frequency.value = 800;
    wind.Q.value = 1.2;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    noise.connect(wind);
    wind.connect(wg);
    wg.connect(bus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.12;
    lfo.connect(lfoG);
    lfoG.connect(wg.gain);
    lfo.start();
    const stopBirds = scheduleBirds(ctx, bus);
    const stopCars = scheduleCarPasses(ctx, bus);
    stops.push(() => {
      noise.stop();
      lfo.stop();
      stopBirds();
      stopCars();
    });
  }
  if (name === "parking") {
    const drone = tone(ctx, 44, 0.09, bus);
    const vent = noiseSource(ctx, 3);
    const vlp = ctx.createBiquadFilter();
    vlp.type = "bandpass";
    vlp.frequency.value = 260;
    vlp.Q.value = 1.6;
    const vg = ctx.createGain();
    vg.gain.value = 0.4;
    vent.connect(vlp);
    vlp.connect(vg);
    vg.connect(bus);
    vent.start();
    const flicker = tone(ctx, 118, 0.02, bus);
    const stopDrips = scheduleDrips(ctx, bus, [5e3, 14e3]);
    stops.push(() => {
      drone.stop();
      vent.stop();
      flicker.stop();
      stopDrips();
    });
  }
  if (name === "stairwell") {
    const noise = noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 380;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.value = 0.4;
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(bus);
    noise.start();
    const hum = tone(ctx, 100, 0.02, bus);
    const stopDrips = scheduleDrips(ctx, bus, [9e3, 22e3]);
    stops.push(() => {
      noise.stop();
      hum.stop();
      stopDrips();
    });
  }
  if (name === "shop") {
    const buzz = tone(ctx, 120, 0.035, bus);
    const fridge = tone(ctx, 62, 0.05, bus);
    const noise = noiseSource(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6e3;
    const ng = ctx.createGain();
    ng.gain.value = 0.04;
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(bus);
    noise.start();
    const stopScanner = scheduleScanner(ctx, bus);
    const stopChime = scheduleDoorChime(ctx, bus);
    stops.push(() => {
      buzz.stop();
      fridge.stop();
      noise.stop();
      stopScanner();
      stopChime();
    });
  }
  return {
    gain: bus,
    stop: () => {
      for (const s of stops) s();
      window.setTimeout(() => bus.disconnect(), 100);
    }
  };
}
var AmbienceEngine = class {
  current = null;
  currentName = "none";
  /** Overall ambience loudness relative to the master bus. */
  level = 0.16;
  /** Crossfade to a new bed; safe to call before audio is unlocked. */
  set(name) {
    if (name === this.currentName) return;
    const graph = lofiPlayer.graph;
    if (!graph) {
      this.currentName = "none";
      this.pending = name;
      return;
    }
    this.pending = null;
    const { ctx, master } = graph;
    const old = this.current;
    if (old) {
      const now = ctx.currentTime;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + FADE_S);
      window.setTimeout(() => old.stop(), (FADE_S + 0.2) * 1e3);
    }
    const bed = buildBed(ctx, name, master);
    if (bed) {
      const now = ctx.currentTime;
      bed.gain.gain.setValueAtTime(0, now);
      bed.gain.gain.linearRampToValueAtTime(this.level, now + FADE_S);
    }
    this.current = bed;
    this.currentName = name;
  }
  pending = null;
  /** Call once after the first gesture unlocks audio. */
  applyPending() {
    if (this.pending) {
      const wish = this.pending;
      this.pending = null;
      this.currentName = "none";
      this.set(wish);
    }
  }
};
var ambience = new AmbienceEngine();

// src/engine/core/runtime-cull.tsx
var import_react = __toESM(require_react(), 1);

// src/engine/core/runtime-perf.ts
var OPEN_BAND = {
  x0: Number.NEGATIVE_INFINITY,
  x1: Number.POSITIVE_INFINITY
};

// src/engine/core/runtime-cull.tsx
var BandContext = (0, import_react.createContext)(null);

// src/engine/runtime/GameRuntime.tsx
var import_react3 = __toESM(require_react(), 1);

// src/engine/ui/DialogueBox.tsx
var import_react2 = __toESM(require_react(), 1);

// src/engine/scene/pixelLight.tsx
function pxPath(rects) {
  let d = "";
  for (const [x, y, w, h] of rects) d += `M${x} ${y}h${w}v${h}h${-w}z`;
  return d;
}
function ellipseRows(rx, ry, step) {
  const out = [];
  for (let dy = -ry; dy < ry; dy += step) {
    const t = 1 - ((dy + step / 2) / ry) ** 2;
    if (t <= 0) continue;
    const hw = Math.round(rx * Math.sqrt(t));
    if (hw > 0) out.push([-hw, dy, hw * 2, step]);
  }
  return out;
}
function offset(rects, cx, cy) {
  return rects.map(([x, y, w, h]) => [x + cx, y + cy, w, h]);
}
function pool(cx, cy, rx, ry, step = 2) {
  return [
    { d: pxPath(offset(ellipseRows(rx, ry, step), cx, cy)), o: 0.07 },
    { d: pxPath(offset(ellipseRows(rx * 0.78, ry * 0.78, step), cx, cy)), o: 0.08 },
    { d: pxPath(offset(ellipseRows(rx * 0.52, ry * 0.52, step), cx, cy)), o: 0.1 },
    { d: pxPath(offset(ellipseRows(rx * 0.3, ry * 0.3, step), cx, cy)), o: 0.12 }
  ];
}
var POOLS = {
  /** the wall lamp's throw on the render */
  lampWall: pool(116, 70, 34, 26),
  /** the same lamp's pool on the concrete */
  lampFloor: pool(116, 158, 54, 14),
  /** warm spill from the living-room window */
  windowLiving: pool(57, 110, 54, 52, 2),
  /** the bedroom window, smaller */
  windowBed: pool(177, 90, 38, 34, 2)
};
var BULB_X = [14, 38, 62, 86, 110, 134, 158, 182, 206, 230, 254, 278, 300];
var RAIL = 136;
var bulbY = (i) => RAIL + (i % 2 === 0 ? 8 : 11);
var BULB_CORE = pxPath(
  BULB_X.flatMap((x, i) => {
    const y = bulbY(i);
    return [
      [x, y, 3, 1],
      [x + 1, y - 1, 1, 3],
      [x, y + 1, 3, 1]
    ];
  })
);
var BULB_OFF = pxPath(
  BULB_X.flatMap((x, i) => {
    const y = bulbY(i);
    return [
      [x, y, 3, 3],
      [x, y, 3, 1]
    ];
  })
);
var HALO_GROUPS = [0, 1, 2].map(
  (m) => pxPath(
    BULB_X.flatMap((x, i) => {
      if (i % 3 !== m) return [];
      const cx = x + 1;
      const cy = bulbY(i);
      return [
        [cx - 3, cy, 7, 1],
        [cx, cy - 3, 1, 7],
        [cx - 2, cy - 2, 5, 5]
      ];
    })
  )
);
function bandPath(W3, y, h, skew) {
  const cols = Math.ceil(W3 / 6);
  const rects = [];
  for (let c = 0; c < cols; c++) {
    const dy = Math.round(skew * c / cols);
    rects.push([c * 6, y + dy, 6, h]);
  }
  return pxPath(rects);
}
var W = 310;
var BANDS = {
  // low sun, gets under the overhang and lands high on the render
  dawn: [
    { d: bandPath(W, 50, 8, -14), fill: "url(#ds25)", o: 0.5 },
    { d: bandPath(W, 58, 30, -14), fill: "url(#ds50)", o: 0.34 },
    { d: bandPath(W, 88, 10, -14), fill: "url(#ds12)", o: 0.4 }
  ],
  // overhang blocks the wall; only the outer slab burns
  day: [
    { d: pxPath([[0, 138, W, 6]]), fill: "url(#ds25)", o: 0.5 },
    { d: pxPath([[0, 144, W, 14]]), fill: "url(#ds50)", o: 0.3 },
    { d: pxPath([[0, 158, W, 4]]), fill: "url(#ds12)", o: 0.4 }
  ],
  // low and orange, reaches all the way to the back wall
  dusk: [
    { d: bandPath(W, 94, 8, -16), fill: "url(#de25)", o: 0.55 },
    { d: bandPath(W, 102, 34, -16), fill: "url(#de50)", o: 0.36 },
    { d: bandPath(W, 136, 12, -16), fill: "url(#de12)", o: 0.45 }
  ]
};
var H = 180;
var VIG = [
  {
    d: pxPath([
      [0, 0, W, 6],
      [0, H - 8, W, 8],
      [0, 0, 8, H],
      [W - 8, 0, 8, H]
    ]),
    p: "dn50"
  },
  {
    d: pxPath([
      [0, 6, W, 6],
      [0, H - 16, W, 8],
      [8, 0, 8, H],
      [W - 16, 0, 8, H]
    ]),
    p: "dn25"
  },
  {
    d: pxPath([
      [0, 12, W, 8],
      [0, H - 26, W, 10],
      [16, 0, 10, H],
      [W - 26, 0, 10, H]
    ]),
    p: "dn12"
  }
];

// src/engine/sprite/characterBuilder.ts
function patchMap(map, patch) {
  const out = map.map((row2) => row2.split(""));
  patch.rows.forEach((prow, dr) => {
    [...prow].forEach((ch, dc) => {
      if (ch === "." || ch === " ") return;
      const rr = patch.r + dr;
      const cc = patch.c + dc;
      if (out[rr] && cc >= 0 && cc < out[rr].length) out[rr][cc] = ch;
    });
  });
  return out.map((row2) => row2.join(""));
}
function stackMaps(...parts) {
  return parts.flatMap((p) => [...p]);
}
function replaceColor(map, fromKey, toKey) {
  return map.map((row2) => row2.split(fromKey).join(toKey));
}
var CharacterBuilder = class _CharacterBuilder {
  cellSize;
  palette;
  parts = /* @__PURE__ */ new Map();
  frames = /* @__PURE__ */ new Map();
  cycle = [];
  actionTable = {};
  speed;
  constructor(opts) {
    this.palette = opts.palette;
    this.cellSize = opts.cell ?? 2;
    this.speed = opts.walkSpeed;
  }
  /** Register a reusable body part (rows of palette keys). */
  part(name, map) {
    if (this.parts.has(name)) throw new Error(`character: part "${name}" already defined`);
    this.parts.set(name, map);
    return this;
  }
  /** Compose a frame from parts and patches. */
  frame(name, make) {
    if (this.frames.has(name)) throw new Error(`character: frame "${name}" already defined`);
    let acc = null;
    const factory = {
      stack: (...partNames) => {
        const maps = partNames.map((p) => {
          const m = this.parts.get(p);
          if (!m) throw new Error(`character: frame "${name}" wants unknown part "${p}"`);
          return m;
        });
        acc = stackMaps(...acc ? [acc, ...maps] : maps);
        return factory;
      },
      patch: (p) => {
        if (!acc) throw new Error(`character: frame "${name}" patches before stack/raw`);
        acc = patchMap(acc, p);
        return factory;
      },
      raw: (map) => {
        acc = [...map];
        return factory;
      },
      map: (fn) => {
        if (!acc) throw new Error(`character: frame "${name}" maps before stack/raw`);
        acc = fn(acc);
        return factory;
      }
    };
    make(factory);
    if (!acc) throw new Error(`character: frame "${name}" produced nothing`);
    this.frames.set(name, acc);
    return this;
  }
  /** Derive a frame from an existing one via a pure transform. */
  variant(name, from, transform) {
    const base = this.frames.get(from);
    if (!base) throw new Error(`character: variant "${name}" from unknown frame "${from}"`);
    if (this.frames.has(name)) throw new Error(`character: frame "${name}" already defined`);
    this.frames.set(name, transform(base));
    return this;
  }
  /** The looping walk frames, in order. */
  walkCycle(...frameNames) {
    this.cycle = frameNames;
    return this;
  }
  /** Register an action animation (see ActionDef). */
  action(id, def) {
    if (this.actionTable[id]) throw new Error(`character: action "${id}" already defined`);
    this.actionTable[id] = def;
    return this;
  }
  /** A palette-swapped twin (outfits, NPC recolors) sharing all frames. */
  skin(paletteOverrides) {
    const twin = new _CharacterBuilder({
      palette: { ...this.palette, ...paletteOverrides },
      cell: this.cellSize,
      walkSpeed: this.speed
    });
    twin.parts = this.parts;
    twin.frames = new Map(this.frames);
    twin.cycle = [...this.cycle];
    twin.actionTable = { ...this.actionTable };
    return twin;
  }
  /** Validate everything and produce a PlayerConfig. */
  build() {
    if (this.frames.size === 0) throw new Error("character: no frames defined");
    let cols = 0;
    let rows = 0;
    for (const map of this.frames.values()) {
      rows = Math.max(rows, map.length);
      for (const row2 of map) cols = Math.max(cols, row2.length);
    }
    const emptyRow = ".".repeat(cols);
    for (const [name, map] of this.frames) {
      const padded = map.map(
        (row2) => row2.length < cols ? row2 + ".".repeat(cols - row2.length) : row2
      );
      while (padded.length < rows) padded.push(emptyRow);
      this.frames.set(name, padded);
      for (const row2 of map) {
        for (const ch of row2) {
          if (ch !== "." && ch !== " " && !(ch in this.palette)) {
            throw new Error(`character: frame "${name}" uses unknown palette key "${ch}"`);
          }
        }
      }
    }
    if (this.cycle.length === 0) throw new Error("character: walkCycle is empty");
    for (const f of this.cycle) {
      if (!this.frames.has(f)) throw new Error(`character: walkCycle frame "${f}" not defined`);
    }
    for (const [id, def] of Object.entries(this.actionTable)) {
      for (const f of def.frames) {
        if (!this.frames.has(f)) {
          throw new Error(`character: action "${id}" uses unknown frame "${f}"`);
        }
      }
    }
    return {
      width: cols * this.cellSize,
      height: rows * this.cellSize,
      palette: this.palette,
      frames: Object.fromEntries(this.frames),
      walkCycle: this.cycle,
      actions: this.actionTable,
      cell: this.cellSize,
      walkSpeed: this.speed
    };
  }
};
function createCharacter(opts) {
  return new CharacterBuilder(opts);
}

// src/engine/sprite/npcBody.ts
var W2 = 24;
var HEAD_ROWS = 7;
var TORSO_ROWS = 15;
var LEG_ROWS = 16;
var ROWS = HEAD_ROWS + TORSO_ROWS + LEG_ROWS;
var CENTRE = 12;
function row(...spans) {
  const cells = new Array(W2).fill(".");
  for (const [start, text] of spans) {
    for (let i = 0; i < text.length; i++) {
      const x = start + i;
      if (x >= 0 && x < W2) cells[x] = text[i];
    }
  }
  return cells.join("");
}
var band = (start, len, zone) => [
  start,
  zone.repeat(Math.max(0, len))
];
function shell(centre, half, fill, edge = fill) {
  const len = half * 2;
  return row([centre - half, edge + fill.repeat(Math.max(0, len - 2)) + edge]);
}
function stamp(map, cells) {
  const out = map.map((r) => r.split(""));
  for (const { x, y, z } of cells) {
    if (y >= 0 && y < out.length && x >= 0 && x < W2) out[y][x] = z;
  }
  return out.map((r) => r.join(""));
}
function stroke(x0, y0, x1, y1, z, thick = 2) {
  const cells = [];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);
    for (let k = 0; k < thick; k++) cells.push({ x: x + k, y, z });
  }
  return cells;
}
var SHOULDER = { slim: 6, regular: 7, stout: 8 };
var WAIST = { slim: 5, regular: 6, stout: 7 };
var TRIM = { short: 3, average: 1, tall: 0 };
function anatomy(build) {
  const sh = SHOULDER[build];
  const wa = WAIST[build];
  const legW = Math.max(2, wa - 1);
  const shoulderY = HEAD_ROWS + 1;
  return {
    sh,
    wa,
    legW,
    /** torso columns, inclusive */
    bodyL: CENTRE - sh,
    bodyR: CENTRE + sh - 1,
    /**
     * The shoulder joints, just outside the torso: a stroke is two pixels wide
     * and drawn rightwards from its anchor, so the left arm anchors two columns
     * clear of the body and the right one column clear. Any further in and the
     * arm paints over the chest it is meant to hang beside.
     */
    shoulderY,
    shoulderL: CENTRE - sh - 2,
    shoulderR: CENTRE + sh,
    /** seen edge-on, an arm hangs on the centre line rather than at the shoulder */
    shoulderSide: CENTRE - 1,
    /** a relaxed arm reaches to here */
    elbowY: shoulderY + UPPER_ARM,
    wristY: shoulderY + UPPER_ARM + FOREARM,
    /** hips and the leg tops */
    hipY: HEAD_ROWS + TORSO_ROWS,
    legL: CENTRE - wa,
    legR: CENTRE + wa - legW,
    headL: 8,
    headR: 15,
    floorY: ROWS - 1
  };
}
function solveElbow(sx, sy, tx, ty, bend) {
  let dx = tx - sx;
  let dy = ty - sy;
  let d = Math.hypot(dx, dy) || 1e-3;
  const far = UPPER_ARM + FOREARM - 0.5;
  const near = Math.abs(UPPER_ARM - FOREARM) + 0.5;
  const k = d > far ? far / d : d < near ? near / d : 1;
  dx *= k;
  dy *= k;
  d *= k;
  const along = (UPPER_ARM * UPPER_ARM - FOREARM * FOREARM + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, UPPER_ARM * UPPER_ARM - along * along));
  const ux = dx / d;
  const uy = dy / d;
  return {
    ex: Math.round(sx + along * ux - bend * off * uy),
    ey: Math.round(sy + along * uy + bend * off * ux),
    wx: Math.round(sx + dx),
    wy: Math.round(sy + dy)
  };
}
var UPPER_ARM = 6;
var FOREARM = 5;
function reach(v, len) {
  const m = Math.hypot(v[0], v[1]);
  if (m === 0) return [0, 0];
  return [Math.round(v[0] * len / m), Math.round(v[1] * len / m)];
}
function arm(a, side, pose, opts = {}) {
  const cloth = opts.cloth ?? "t";
  const shadeZone = opts.shade ?? "T";
  const skin = opts.skin ?? "s";
  const sleeve = opts.sleeve ?? "short";
  const sx = opts.at ?? (side === 1 ? a.shoulderR : a.shoulderL);
  const sy = a.shoulderY;
  const { ex, ey, wx, wy } = joints(side, pose, sx, sy);
  const cells = [];
  cells.push(...stroke(sx, sy, ex, ey, sleeve === "bare" ? skin : cloth, 2));
  cells.push(...stroke(ex, ey, wx, wy, sleeve === "long" ? cloth : skin, 2));
  if (sleeve === "long") {
    cells.push({ x: wx, y: wy - 1, z: shadeZone }, { x: wx + 1, y: wy - 1, z: shadeZone });
  } else if (sleeve === "short") {
    cells.push({ x: ex, y: ey, z: shadeZone }, { x: ex + 1, y: ey, z: shadeZone });
  }
  const kind = pose.hand ?? "open";
  if (kind !== "none") {
    const hx = wx - (side === 1 ? 0 : 1);
    cells.push(
      { x: hx, y: wy + 1, z: skin },
      { x: hx + 1, y: wy + 1, z: skin },
      { x: hx + 2, y: wy + 1, z: skin },
      { x: hx, y: wy + 2, z: kind === "grip" ? "S" : skin },
      { x: hx + 1, y: wy + 2, z: "S" },
      { x: hx + 2, y: wy + 2, z: kind === "grip" ? "S" : "S" }
    );
    if (kind === "open") cells.push({ x: hx + 1, y: wy + 3, z: skin });
  }
  return cells;
}
function joints(side, pose, sx, sy) {
  if (pose.to) {
    const tx = side === 1 ? pose.to[0] : 2 * CENTRE - 1 - pose.to[0];
    return solveElbow(sx, sy, tx, pose.to[1], (pose.bend ?? 1) * side);
  }
  const [edx, edy] = reach(pose.elbow, UPPER_ARM);
  const [wdx, wdy] = reach(pose.wrist, FOREARM);
  const ex = sx + edx * side;
  const ey = sy + edy;
  return { ex, ey, wx: ex + wdx * side, wy: ey + wdy };
}
function handAt(a, side, pose, at) {
  const sx = at ?? (side === 1 ? a.shoulderR : a.shoulderL);
  const { wx, wy } = joints(side, pose, sx, a.shoulderY);
  return { x: wx, y: wy + 1 };
}
var ARM = {
  /** hanging, slightly out from the body */
  rest: { elbow: [0, 5], wrist: [1, 4] },
  /** dead straight down — formal, or asleep on the feet */
  straight: { elbow: [0, 5], wrist: [0, 4] },
  /** hand on the hip */
  hip: { elbow: [1, 5], wrist: [-2, 3], hand: "grip" },
  /** forearm up, palm open: mid-sentence */
  talk: { elbow: [1, 4], wrist: [2, -2] },
  talkWide: { elbow: [2, 4], wrist: [3, -1] },
  /** raised to the side and open: hello, and goodbye */
  waveUp: { elbow: [2, 2], wrist: [2, -4] },
  waveOut: { elbow: [3, 2], wrist: [3, -3] },
  /** both palms up at the waist */
  shrug: { elbow: [1, 5], wrist: [2, 0] },
  /** low and forward: sweeping, digging, holding a handle */
  workLow: { elbow: [1, 4], wrist: [3, 3], hand: "grip" },
  workHigh: { elbow: [1, 3], wrist: [3, 0], hand: "grip" },
  /** holding something at the chest */
  hold: { elbow: [0, 4], wrist: [2, -1], hand: "grip" },
  /**
   * Hands that have to touch the face. The head rows are fixed by `npcFace`:
   * 1 brow, 2 eyes, 3 cheek and ear, 4 nose, 5 mouth, 6 chin — and a hand is
   * drawn from the wrist downward, so the wrist goes one row above whatever it
   * is meant to be touching.
   */
  toFace: { elbow: [1, 3], wrist: [1, -4], to: [CENTRE + 2, 1], bend: 1 },
  /** folded across the middle */
  foldOver: { elbow: [1, 5], wrist: [-4, 1], hand: "none" },
  foldUnder: { elbow: [1, 5], wrist: [-4, 2], hand: "none" },
  /** in a pocket */
  pocket: { elbow: [0, 5], wrist: [-1, 3], hand: "none" },
  /** reaching out to hand something over */
  reach: { elbow: [1, 4], wrist: [4, 0] },
  /** carrying a bag: straight, a little forward of the seam */
  carry: { elbow: [0, 5], wrist: [1, 5], hand: "grip" },
  /** hands to the small of the back */
  back: { elbow: [1, 5], wrist: [-3, 2], hand: "none" },
  /** the arm that swings forward on a stride, seen from the side */
  swingFwd: { elbow: [1, 4], wrist: [2, 3] },
  swingBack: { elbow: [-1, 4], wrist: [-2, 3] },
  /** the hand at the mouth: a drink, a cough, a cigarette */
  toMouth: { elbow: [1, 3], wrist: [0, -3], to: [CENTRE + 1, 4], bend: 1, hand: "grip" },
  /**
   * Two hands on one handle, one above the other — a mop, a broom, a shovel.
   * The far arm reaches across to the upper grip and the near one takes the
   * lower, which is how anybody holds a pole they are actually working with,
   * and it is the difference between mopping a floor and standing beside a mop.
   */
  gripHigh: { elbow: [1, 3], wrist: [1, 1], to: [CENTRE + 1, 13], bend: 1, hand: "grip" },
  gripLow: { elbow: [1, 4], wrist: [2, 2], to: [CENTRE + 3, 18], bend: 1, hand: "grip" },
  /** halfway up: the hand at the collarbone, on its way to the mouth */
  toChin: { elbow: [1, 3], wrist: [0, -2], to: [CENTRE + 3, 6], bend: 1, hand: "grip" },
  /** the same, a beat later: knuckles against the lips */
  atLips: { elbow: [1, 3], wrist: [0, -3], to: [CENTRE, 4], bend: 1, hand: "grip" },
  /** holding a handset against the ear, which is where a phone call lives */
  toEar: { elbow: [1, 2], wrist: [0, -4], to: [CENTRE + 3, 2], bend: 1, hand: "grip" },
  /** held out flat, palm up: here, take it */
  offer: { elbow: [1, 4], wrist: [3, 1] },
  /** both hands together in front, counting change */
  count: { elbow: [1, 4], wrist: [1, 0] },
  /** arm up and out, greeting somebody across the street */
  hail: { elbow: [2, 1], wrist: [1, -5] },
  /** hand behind the head — the scratch, the shrug's cousin */
  behindHead: { elbow: [2, 1], wrist: [-2, -3], to: [CENTRE + 4, 0], bend: 1, hand: "none" },
  /** pointing at something */
  point: { elbow: [1, 4], wrist: [4, -1] },
  /**
   * Running arms. Nothing else in the library works for a run: a runner's
   * elbow stays bent at a right angle and the forearm pumps between the chest
   * and the hip, so the hand travels a short vertical arc rather than the long
   * pendulum of a walk.
   */
  pumpUp: { elbow: [1, 3], wrist: [0, -3], hand: "grip" },
  pumpMid: { elbow: [1, 4], wrist: [0, -1], hand: "grip" },
  pumpDown: { elbow: [0, 4], wrist: [-1, 1], hand: "grip" }
};

// src/engine/sprite/npcFace.ts
var SKULLS = {
  oval: { skull: 4, cheek: 4, jaw: 3, chin: 2, crown: "round", chinOut: 0 },
  round: { skull: 4, cheek: 4, jaw: 4, chin: 3, crown: "round", chinOut: 0 },
  square: { skull: 4, cheek: 4, jaw: 4, chin: 3, crown: "flat", chinOut: 1 },
  long: { skull: 3, cheek: 3, jaw: 3, chin: 2, crown: "round", chinOut: 0 },
  gaunt: { skull: 3, cheek: 3, jaw: 2, chin: 2, crown: "flat", chinOut: 1 },
  heart: { skull: 4, cheek: 4, jaw: 3, chin: 1, crown: "round", chinOut: 0 }
};
function skullOf(shape) {
  return SKULLS[shape];
}
var grid = () => Array.from({ length: HEAD_ROWS }, () => new Array(W2).fill("."));
var done = (g) => g.map((r) => r.join(""));
function put(g, x, y, z) {
  if (y >= 0 && y < g.length && x >= 0 && x < W2) g[y][x] = z;
}
function span(g, x0, x1, y, z) {
  for (let x = x0; x <= x1; x++) put(g, x, y, z);
}
var lft = (half) => CENTRE - half;
var rgt = (half) => CENTRE + half - 1;
var EYE_COL = 2;
var NOSE_OUT = {
  small: 1,
  button: 1,
  straight: 1,
  long: 1,
  broad: 2,
  hook: 2
};
function faceGeometry(t) {
  const skull = SKULLS[t.shape];
  return {
    skull,
    eyeL: CENTRE - EYE_COL,
    eyeR: CENTRE + EYE_COL - 1,
    browRow: 1,
    eyeRow: 2,
    noseRow: 4,
    mouthRow: 5,
    chinRow: 6,
    backX: lft(skull.skull),
    faceX: rgt(skull.skull),
    noseOut: NOSE_OUT[t.nose]
  };
}
function headFront(t) {
  const g = grid();
  const geo = faceGeometry(t);
  const s = geo.skull;
  const crownIn = s.crown === "round" ? 1 : 0;
  span(g, lft(s.skull) + crownIn, rgt(s.skull) - crownIn, 0, "h");
  span(g, lft(s.skull), rgt(s.skull), 1, "s");
  put(g, lft(s.skull), 1, "h");
  put(g, rgt(s.skull), 1, "h");
  span(g, lft(s.skull), rgt(s.skull), 2, "s");
  put(g, lft(s.skull), 2, "h");
  put(g, rgt(s.skull), 2, "h");
  span(g, lft(s.cheek), rgt(s.cheek), 3, "s");
  put(g, lft(s.cheek) + 1, 3, "y");
  put(g, rgt(s.cheek), 3, "S");
  span(g, lft(s.cheek), rgt(s.cheek), 4, "s");
  put(g, lft(s.cheek), 4, "S");
  put(g, rgt(s.cheek), 4, "S");
  span(g, lft(s.jaw), rgt(s.jaw), 5, "s");
  put(g, lft(s.jaw), 5, "S");
  put(g, rgt(s.jaw), 5, "S");
  put(g, rgt(s.jaw) - 1, 5, "S");
  span(g, lft(s.chin), rgt(s.chin), 6, "S");
  if (s.chin >= 2) span(g, lft(s.chin) + 1, rgt(s.chin) - 1, 6, "s");
  if (t.ears === "out") {
    put(g, lft(s.cheek) - 1, 3, "s");
    put(g, rgt(s.cheek) + 1, 3, "S");
  }
  drawBrow(g, t, geo);
  drawEyes(g, t, geo);
  drawNose(g, t, geo);
  drawMouth(g, t, geo);
  return done(g);
}
function drawBrow(g, t, geo) {
  const shapes = {
    thin: { out: 0, inn: 0, z: "H" },
    flat: { out: 0, inn: 1, z: "H" },
    heavy: { out: 1, inn: 1, z: "h" },
    arched: { out: 1, inn: 0, z: "H" },
    worried: { out: 0, inn: 1, z: "h" },
    raised: { out: 0, inn: 0, z: "H" }
  };
  const { out, inn, z } = shapes[t.brow];
  span(g, geo.eyeL - out, geo.eyeL + inn, geo.browRow, z);
  span(g, geo.eyeR - inn, geo.eyeR + out, geo.browRow, z);
  if (t.brow === "raised") {
    put(g, geo.eyeL, 0, "y");
    put(g, geo.eyeR, 0, "y");
  }
  if (t.brow === "worried") {
    put(g, geo.eyeL + inn, geo.eyeRow, "H");
    put(g, geo.eyeR - inn, geo.eyeRow, "H");
  }
}
function drawEyes(g, t, geo) {
  put(g, geo.eyeL, geo.eyeRow, "e");
  put(g, geo.eyeR, geo.eyeRow, "e");
  const outL = geo.eyeL - 1;
  const outR = geo.eyeR + 1;
  const room = outL > lft(geo.skull.skull) && outR < rgt(geo.skull.skull);
  switch (t.eyes) {
    case "narrow":
      put(g, geo.eyeL, geo.eyeRow - 1, "S");
      put(g, geo.eyeR, geo.eyeRow - 1, "S");
      break;
    case "deep":
      put(g, geo.eyeL, geo.eyeRow - 1, "S");
      put(g, geo.eyeR, geo.eyeRow - 1, "S");
      put(g, geo.eyeL, geo.eyeRow + 1, "S");
      put(g, geo.eyeR, geo.eyeRow + 1, "S");
      break;
    case "round":
      put(g, geo.eyeL, geo.eyeRow + 1, "S");
      put(g, geo.eyeR, geo.eyeRow + 1, "S");
      break;
    case "wide":
      if (room) {
        put(g, outL, geo.eyeRow, "y");
        put(g, outR, geo.eyeRow, "y");
      }
      break;
    case "bright":
      put(g, geo.eyeL, geo.eyeRow - 1, "y");
      put(g, geo.eyeR, geo.eyeRow - 1, "y");
      break;
    default:
      break;
  }
}
function drawNose(g, t, geo) {
  const x = CENTRE - 1;
  switch (t.nose) {
    case "small":
      put(g, x, geo.noseRow, "S");
      break;
    case "straight":
      put(g, x, geo.noseRow - 1, "S");
      put(g, x, geo.noseRow, "S");
      break;
    case "broad":
      span(g, x, x + 1, geo.noseRow, "S");
      put(g, x, geo.noseRow - 1, "S");
      break;
    case "hook":
      put(g, x, geo.noseRow - 1, "S");
      put(g, x, geo.noseRow, "S");
      put(g, x + 1, geo.noseRow, "S");
      break;
    case "button":
      put(g, x, geo.noseRow - 1, "y");
      put(g, x, geo.noseRow, "S");
      break;
    case "long":
      put(g, x, geo.noseRow - 2, "S");
      put(g, x, geo.noseRow - 1, "S");
      put(g, x, geo.noseRow, "S");
      break;
  }
}
function mouthCells(t, view) {
  const geo = faceGeometry(t);
  const g = grid();
  if (view === "front") drawMouth(g, t, geo);
  else drawProfileMouth(g, t, geo);
  const cells = [];
  g.forEach((line, y) => {
    line.forEach((z, x) => {
      if (z !== ".") cells.push({ x, y, z });
    });
  });
  return cells;
}
function drawMouth(g, t, geo) {
  const r = geo.mouthRow;
  switch (t.mouth) {
    case "neutral":
      span(g, CENTRE - 1, CENTRE, r, "S");
      break;
    case "wide":
      span(g, CENTRE - 2, CENTRE + 1, r, "S");
      break;
    case "thin":
      span(g, CENTRE - 2, CENTRE, r, "S");
      break;
    case "set":
      span(g, CENTRE - 2, CENTRE + 1, r, "S");
      put(g, CENTRE - 1, r + 1, "S");
      put(g, CENTRE, r + 1, "S");
      break;
    case "smile":
      span(g, CENTRE - 1, CENTRE, r, "S");
      put(g, CENTRE - 2, r - 1, "S");
      put(g, CENTRE + 1, r - 1, "S");
      break;
    case "frown":
      span(g, CENTRE - 1, CENTRE, r, "S");
      put(g, CENTRE - 2, r + 1, "S");
      put(g, CENTRE + 1, r + 1, "S");
      break;
  }
}
function headProfile(t) {
  const g = grid();
  const geo = faceGeometry(t);
  const s = geo.skull;
  const back = geo.backX;
  const face = geo.faceX;
  span(g, back, face, 0, "h");
  span(g, back, face, 1, "s");
  span(g, back, back + s.skull - 1, 1, "h");
  span(g, back, face, 2, "s");
  span(g, back, back + s.skull - 2, 2, "h");
  span(g, back + 1, face, 3, "s");
  span(g, back + 1, face, 4, "s");
  put(g, back + 1, 4, "H");
  put(g, face, 4, "S");
  span(g, back + 2, face, 5, "S");
  span(g, back + 2, back + s.jaw + 1, 6, "S");
  span(g, back + 3, back + s.chin + 1, 6, "s");
  drawProfileNose(g, t, geo);
  drawProfileMouth(g, t, geo);
  if (s.chinOut > 0) put(g, face - 1 + s.chinOut, 6, "S");
  const eyeX = face - 2;
  put(g, eyeX, geo.eyeRow, "e");
  if (t.eyes === "deep") put(g, eyeX - 1, geo.eyeRow, "S");
  if (t.eyes === "bright") put(g, eyeX - 1, geo.eyeRow, "y");
  if (t.eyes === "narrow") put(g, eyeX, geo.eyeRow - 1, "S");
  const brow = t.brow === "heavy" || t.brow === "worried" ? "h" : "H";
  put(g, eyeX, geo.browRow, brow);
  if (t.brow === "heavy" || t.brow === "arched") put(g, eyeX + 1, geo.browRow, brow);
  if (t.brow === "raised") put(g, eyeX, 0, "y");
  return done(g);
}
function drawProfileNose(g, t, geo) {
  const face = geo.faceX;
  switch (t.nose) {
    case "small":
      put(g, face + 1, 3, "s");
      break;
    case "button":
      put(g, face + 1, 3, "s");
      put(g, face + 1, 4, "S");
      break;
    case "straight":
      put(g, face + 1, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 1, 5, "S");
      break;
    case "long":
      put(g, face + 1, 2, "s");
      put(g, face + 1, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 1, 5, "S");
      break;
    case "broad":
      put(g, face + 1, 3, "s");
      put(g, face + 2, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 2, 4, "S");
      break;
    case "hook":
      put(g, face + 1, 2, "s");
      put(g, face + 2, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 2, 4, "S");
      break;
  }
}
function drawProfileMouth(g, t, geo) {
  const face = geo.faceX;
  const r = geo.mouthRow;
  put(g, face, r, "S");
  if (t.mouth === "wide" || t.mouth === "set") put(g, face - 1, r, "S");
  if (t.mouth === "smile") put(g, face - 1, r - 1, "S");
  if (t.mouth === "frown") put(g, face - 1, r + 1, "S");
}
function featureCells(kind, t, view) {
  const geo = faceGeometry(t);
  const s = geo.skull;
  const cells = [];
  const at = (x, y, z) => cells.push({ x, y, z });
  if (view === "front") {
    switch (kind) {
      case "beard":
        for (let x = lft(s.jaw); x <= rgt(s.jaw); x++) at(x, 5, "f");
        for (let x = lft(s.chin); x <= rgt(s.chin); x++) at(x, 6, "f");
        at(lft(s.cheek), 4, "F");
        at(rgt(s.cheek), 4, "F");
        at(CENTRE - 1, 5, "F");
        at(CENTRE, 5, "F");
        break;
      case "goatee":
        for (let x = CENTRE - 2; x <= CENTRE + 1; x++) at(x, 6, "f");
        at(CENTRE - 1, 5, "F");
        at(CENTRE, 5, "F");
        break;
      case "moustache":
        for (let x = CENTRE - 2; x <= CENTRE + 1; x++) at(x, 5, "f");
        break;
      case "stubble":
        for (let x = lft(s.jaw); x <= rgt(s.jaw); x += 2) at(x, 5, "F");
        for (let x = lft(s.chin); x <= rgt(s.chin); x++) at(x, 6, "F");
        break;
      case "sideburns":
        at(lft(s.cheek), 3, "f");
        at(rgt(s.cheek), 3, "f");
        at(lft(s.cheek), 4, "F");
        at(rgt(s.cheek), 4, "F");
        break;
      case "glasses":
        at(geo.eyeL - 1, geo.eyeRow, "c");
        at(geo.eyeL + 1, geo.eyeRow, "c");
        at(geo.eyeR - 1, geo.eyeRow, "c");
        at(geo.eyeR + 1, geo.eyeRow, "c");
        at(CENTRE - 1, geo.eyeRow, "c");
        break;
      case "sunglasses":
        for (let x = geo.eyeL - 1; x <= geo.eyeR + 1; x++) at(x, geo.eyeRow, "n");
        break;
      case "old":
        at(lft(s.skull) + 1, geo.eyeRow + 1, "S");
        at(rgt(s.skull) - 1, geo.eyeRow + 1, "S");
        at(CENTRE - 2, geo.noseRow, "S");
        at(CENTRE + 1, geo.noseRow, "S");
        break;
      case "tired":
        at(geo.eyeL, geo.eyeRow + 1, "S");
        at(geo.eyeR, geo.eyeRow + 1, "S");
        break;
      case "freckles":
        at(lft(s.cheek) + 1, geo.noseRow, "S");
        at(rgt(s.cheek) - 1, geo.noseRow, "S");
        at(CENTRE - 2, geo.noseRow - 1, "S");
        break;
      case "blusher":
        at(lft(s.cheek) + 1, geo.noseRow, "y");
        at(rgt(s.cheek) - 1, geo.noseRow, "y");
        break;
      case "scar":
        at(rgt(s.skull) - 1, geo.browRow, "S");
        at(rgt(s.skull) - 1, geo.eyeRow + 1, "S");
        break;
    }
    return cells;
  }
  const face = geo.faceX;
  switch (kind) {
    case "beard":
      at(face, 5, "f");
      at(face - 1, 5, "f");
      for (let x = geo.backX + 2; x <= face; x++) at(x, 6, "f");
      at(face - 1, 4, "F");
      break;
    case "goatee":
      at(face - 1, 6, "f");
      at(face, 6, "f");
      break;
    case "moustache":
      at(face - 1, 5, "f");
      at(face, 5, "f");
      break;
    case "stubble":
      at(face, 5, "F");
      for (let x = geo.backX + 2; x <= face; x++) at(x, 6, "F");
      break;
    case "sideburns":
      at(geo.backX + s.skull - 1, 3, "f");
      at(geo.backX + s.skull - 1, 4, "F");
      break;
    case "glasses":
      at(face - 3, geo.eyeRow, "c");
      at(face - 1, geo.eyeRow, "c");
      at(geo.backX + 2, geo.eyeRow, "c");
      break;
    case "sunglasses":
      for (let x = face - 3; x <= face; x++) at(x, geo.eyeRow, "n");
      break;
    case "old":
      at(face - 3, geo.eyeRow + 1, "S");
      at(face - 1, geo.noseRow, "S");
      break;
    case "tired":
      at(face - 2, geo.eyeRow + 1, "S");
      break;
    case "freckles":
      at(face - 2, geo.noseRow, "S");
      break;
    case "blusher":
      at(face - 2, geo.noseRow, "y");
      break;
    case "scar":
      at(face - 2, geo.browRow, "S");
      break;
  }
  return cells;
}
var SHAPES = ["oval", "round", "square", "long", "gaunt", "heart"];
var BROWS = ["thin", "flat", "heavy", "arched", "worried", "raised"];
var EYES = ["normal", "wide", "round", "narrow", "deep", "bright"];
var NOSES = ["small", "straight", "broad", "hook", "button", "long"];
var MOUTHS = ["neutral", "wide", "thin", "smile", "frown", "set"];
function hash(seed, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1e3;
}
var pick = (list, seed, salt) => list[hash(seed, salt) % list.length];
function faceFor(id, given = {}) {
  return {
    shape: given.shape ?? pick(SHAPES, id, 1),
    brow: given.brow ?? pick(BROWS, id, 2),
    eyes: given.eyes ?? pick(EYES, id, 3),
    nose: given.nose ?? pick(NOSES, id, 4),
    mouth: given.mouth ?? pick(MOUTHS, id, 5),
    ears: given.ears ?? (hash(id, 6) < 300 ? "out" : "flat")
  };
}

// src/engine/sprite/npcHair.ts
var HAIR = "h";
var HAIR_SHADE = "H";
var HAIR_LIT = "i";
var STUBBLE = "f";
var STUBBLE_SHADE = "F";
var SKIN = "s";
var SKIN_SHADE = "S";
var SKIN_LIT = "y";
var HAT = "k";
var HAT_SHADE = "K";
var HAT_LIT = "j";
var OCCLUDE = "d";
var BARE = ".";
function pen(geo) {
  const half = geo.skull.skull;
  const L = CENTRE - half;
  const R = CENTRE + half - 1;
  const OL = L - 1;
  const OR = R + 1;
  const cells = /* @__PURE__ */ new Map();
  const at = (x, y, z = HAIR) => {
    if (x < OL || x > OR || y < 0 || y >= HEAD_ROWS) return;
    cells.set(`${x}:${y}`, { x, y, z });
  };
  const span2 = (x0, x1, y, z = HAIR) => {
    for (let x = x0; x <= x1; x++) at(x, y, z);
  };
  const col = (x, y0, y1, z = HAIR) => {
    for (let y = y0; y <= y1; y++) at(x, y, z);
  };
  const tint = (x, y, z) => {
    const key = `${x}:${y}`;
    const there = cells.get(key);
    if (there && there.z !== BARE) cells.set(key, { x, y, z });
  };
  return {
    L,
    R,
    OL,
    OR,
    /**
     * How far a close cut is inset from the silhouette at the crown. A round
     * skull keeps its rounded corners under short hair; a narrow one does not,
     * because six columns of crown cannot give two away — and because the
     * builder drops its crown highlight three columns left of centre whatever
     * the head, which on an inset narrow crown lands beside the hair instead
     * of on it.
     */
    crownIn: geo.skull.crown === "round" && half >= 4 ? 1 : 0,
    /**
     * How far a temple may come in along the brow row before it starts rubbing
     * out an eyebrow. On a narrow head the answer is: not at all.
     */
    room: Math.max(0, half - 3),
    at,
    span: span2,
    col,
    tint,
    cells
  };
}
function shadeMass(cells, eyeRow) {
  const solid = (x, y) => {
    const c = cells.get(`${x}:${y}`);
    return c !== void 0 && c.z !== BARE;
  };
  let crownEdge = Number.POSITIVE_INFINITY;
  for (const cell of cells.values()) {
    if (cell.y === 0 && cell.z !== BARE) crownEdge = Math.min(crownEdge, cell.x);
  }
  const out = [];
  for (const cell of cells.values()) {
    if (cell.z !== HAIR) {
      out.push(cell);
      continue;
    }
    const { x, y } = cell;
    const left = solid(x - 1, y);
    const right = solid(x + 1, y);
    let z = HAIR;
    if (left && !right) z = HAIR_SHADE;
    if (y === 0 && right && x <= crownEdge + 1) z = HAIR_LIT;
    if (!solid(x, y + 1) && y >= eyeRow) z = HAIR_SHADE;
    out.push({ x, y, z });
  }
  return out;
}
function curl(p, y0, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = p.OL; x <= p.OR; x++) {
      if ((x + 2 * y) % 3 === 0) p.tint(x, y, HAIR_SHADE);
    }
  }
}
function scalp(p, z, lit, shade) {
  p.span(p.L + p.crownIn, p.R - p.crownIn, 0, z);
  p.at(p.L + p.crownIn, 0, lit);
  p.at(p.R - p.crownIn, 0, shade);
  if (p.crownIn) {
    p.at(p.L, 0, BARE);
    p.at(p.R, 0, BARE);
  }
}
function fadedSides(p) {
  p.at(p.L, 1, STUBBLE);
  p.at(p.R, 1, STUBBLE_SHADE);
  p.at(p.L, 2, STUBBLE);
  p.at(p.R, 2, STUBBLE_SHADE);
}
function shortSides(p) {
  p.at(p.L, 1);
  p.at(p.L, 2);
}
var HAIR_STYLE = {
  /** the plain one every other cut is read against: neat, close, ears clear */
  short: (p) => {
    p.span(p.L, p.R, 0);
    shortSides(p);
    if (p.room) p.at(p.L + 1, 1);
  },
  /** a number two all over: the sides go up above the ear and stay there */
  crop: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    p.at(p.L, 1);
    p.at(p.R, 1);
    p.at(p.L, 2, STUBBLE);
    p.at(p.R, 2, STUBBLE_SHADE);
  },
  /** clipped to the scalp: no mass at all, only a shadow of one */
  shaved: (p) => {
    scalp(p, STUBBLE, STUBBLE, STUBBLE_SHADE);
    fadedSides(p);
  },
  /** bare over the top, and what is left grows low round the ears */
  bald: (p) => {
    scalp(p, SKIN, SKIN_LIT, SKIN_SHADE);
    p.at(p.L, 1, SKIN);
    p.at(p.R, 1, SKIN_SHADE);
    p.at(p.L, 2);
    p.at(p.R, 2, HAIR_SHADE);
  },
  /** the corners have gone first, as they always do, and taken the temples */
  receding: (p) => {
    scalp(p, SKIN, SKIN_LIT, SKIN_SHADE);
    p.span(p.L + p.crownIn + 1, p.R - p.crownIn - 1, 0, HAIR);
    p.at(p.L, 1, SKIN);
    p.at(p.R, 1, SKIN_SHADE);
    p.at(p.L, 2);
    p.at(p.R, 2);
  },
  /** weight kept on top, sides taken off: the whole cut is that one step */
  undercut: (p) => {
    p.span(p.OL, p.OR, 0);
    fadedSides(p);
  },
  /** the same fade, and everything left over gathered and tied on the crown */
  topknot: (p) => {
    scalp(p, STUBBLE, STUBBLE, STUBBLE_SHADE);
    fadedSides(p);
    p.span(CENTRE - 2, CENTRE + 1, 0, HAIR);
  },
  /** pushed up and apart, so the top edge is a gap and a clump, not a line */
  spiky: (p) => {
    p.span(p.OL, p.OR, 0);
    p.at(CENTRE + 1, 0, BARE);
    shortSides(p);
  },
  /** parted down the middle and swept off the forehead either side of it */
  curtains: (p) => {
    p.span(p.L, p.R, 0);
    p.tint(CENTRE, 0, HAIR_SHADE);
    p.span(p.L, CENTRE - 2, 1);
    p.span(CENTRE + 1, p.R, 1);
    p.tint(CENTRE - 2, 1, HAIR_SHADE);
    p.tint(CENTRE + 1, 1, HAIR_SHADE);
    p.at(p.L, 2);
    p.at(p.R, 2);
  },
  /** cut straight across the brow, and the eyebrows go with it */
  fringe: (p) => {
    p.span(p.L, p.R, 0);
    p.span(p.L, p.R, 1);
    p.at(p.L, 2);
    p.at(p.R, 2);
  },
  /** somebody's mother did this one: heavy fringe, ears buried, straight hem */
  bowl: (p) => {
    p.span(p.OL, p.OR, 0);
    p.span(p.OL, p.OR, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.at(p.OL, 3);
    p.at(p.L, 3);
  },
  /** to the jaw and turning under, parted rather than fringed */
  bob: (p) => {
    p.span(p.L, p.R, 0);
    p.at(p.OL, 0);
    p.at(p.OR, 0);
    p.at(p.OL, 1);
    p.at(p.OR, 1);
    p.at(p.L, 1);
    p.at(p.R, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.col(p.OL, 3, 4);
    p.col(p.L, 3, 5);
  },
  /** past the collar, and tucked behind the far ear so the face stays a face */
  long: (p) => {
    p.span(p.L, p.R, 0);
    p.at(p.OL, 0);
    p.at(p.OR, 0);
    p.at(p.OL, 1);
    p.at(p.OR, 1);
    p.at(p.L, 1);
    p.at(p.R, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.col(p.OL, 3, 6);
    p.col(p.L, 3, 6);
  },
  /** volume everywhere and a shadow in every third pixel of it */
  curly: (p) => {
    p.span(p.OL, p.OR, 0);
    p.span(p.OL, p.L + p.room, 1);
    p.span(p.R - p.room, p.OR, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    curl(p, 0, 2);
  },
  /** the same, grown out: wider at the ears than at the crown, and rounder */
  afro: (p) => {
    p.span(p.OL, p.OR, 0);
    p.span(p.OL, p.L + p.room, 1);
    p.span(p.R - p.room, p.OR, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.at(p.OL, 3);
    curl(p, 0, 3);
  },
  /** scraped back flat, so all the interest is the knot behind the crown */
  bun: (p) => {
    p.span(p.L, p.R, 0);
    shortSides(p);
    p.at(p.OL, 0);
    p.at(p.OL, 1);
    p.at(p.OL, 2, HAIR_SHADE);
  },
  /** gathered behind the ear and hanging to the shoulder */
  ponytail: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    shortSides(p);
    p.col(p.OL, 2, 5);
    p.at(p.L, 3);
    p.at(p.L, 4);
  },
  /** the same tail, plaited: a shadow across it every other row is the trick */
  braid: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    shortSides(p);
    p.col(p.OL, 2, 6);
    p.col(p.L, 3, 6);
    p.at(p.OL, 4, HAIR_SHADE);
    p.at(p.L, 4, HAIR_SHADE);
    p.at(p.OL, 6, HAIR_SHADE);
    p.at(p.L, 6, HAIR_SHADE);
  },
  /** short and flat on top, and then it simply does not stop at the collar */
  mullet: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    shortSides(p);
    p.col(p.OL, 2, 6);
    p.at(p.L, 5);
    p.at(p.L, 6);
  }
};
var HAT_STYLE = {
  /** crown, and a peak that projects forward over the brow and shades it */
  cap: (p) => {
    p.span(p.OL, p.R, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.R, 0, HAT_SHADE);
    p.span(p.L, p.OR, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
  },
  /** knitted, hugging the skull, turned up at the brow and over the ears */
  beanie: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    for (let x = p.OL; x <= p.OR; x += 2) p.at(x, 1, HAT_SHADE);
    p.at(p.OL, 2, HAT);
    p.at(p.L, 2, HAT);
    p.at(p.R, 2, HAT_SHADE);
    p.at(p.OR, 2, HAT_SHADE);
  },
  /** tied under the fringe and knotted at the nape, ends hanging */
  kerchief: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    p.at(p.OR, 1, HAT_SHADE);
    p.at(p.OL, 2, HAT_SHADE);
    p.at(p.L, 2, HAT_SHADE);
    p.at(p.R, 2, HAT_SHADE);
    p.at(p.OR, 2, HAT_SHADE);
    p.at(p.OL, 3, HAT);
    p.at(p.OL, 4, HAT_SHADE);
  },
  /** bigger than the head: walls either side of the face and a dark mouth */
  hood: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    p.at(p.L, 1, OCCLUDE);
    p.at(p.R, 1, OCCLUDE);
    p.at(p.OL, 2, HAT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
    p.at(p.OR, 2, HAT_SHADE);
    p.col(p.OL, 3, 5, HAT);
    p.at(p.L, 3, HAT_SHADE);
    p.at(p.L, 4, HAT_SHADE);
  },
  /** a narrow crown standing above a brim that is wider than the head */
  fedora: (p) => {
    p.span(p.L, p.R, 0, HAT);
    p.at(p.L, 0, HAT_SHADE);
    p.at(p.L + 1, 0, HAT_LIT);
    p.at(p.R, 0, HAT_SHADE);
    p.span(p.OL, CENTRE - 1, 1, HAT);
    p.span(CENTRE, p.OR, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT_LIT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
  },
  /** a shell with a ridge down it and a brim all the way round */
  hardhat: (p) => {
    p.span(p.L, p.R, 0, HAT);
    p.at(CENTRE - 1, 0, HAT_LIT);
    p.at(CENTRE, 0, HAT_SHADE);
    p.at(p.R, 0, HAT_SHADE);
    p.span(p.OL, CENTRE - 1, 1, HAT);
    p.span(CENTRE, p.OR, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT_LIT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
  },
  /** fur, a deep band, and the flaps down over both ears */
  ushanka: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    for (let x = p.OL; x <= p.OR; x += 3) p.at(x, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    p.at(p.OR, 1, HAT_SHADE);
    p.at(p.OL, 2, HAT);
    p.at(p.L, 2, HAT);
    p.at(p.R, 2, HAT_SHADE);
    p.at(p.OR, 2, HAT_SHADE);
    p.at(p.OL, 3, HAT);
    p.at(p.OL, 4, HAT_SHADE);
  },
  /** a soft disc that has slumped off the back of the head, hair showing */
  beret: (p) => {
    p.span(p.OL, p.R - 1, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.R - 1, 0, HAT_SHADE);
    p.span(p.L, p.R, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT);
    p.at(p.L, 1, HAT);
    p.at(p.OL, 2, HAT_SHADE);
  }
};
function hairCells(style, geo) {
  const p = pen(geo);
  HAIR_STYLE[style](p);
  return shadeMass(p.cells, geo.eyeRow);
}
function hatCells(hat, geo) {
  const p = pen(geo);
  HAT_STYLE[hat](p);
  return [...p.cells.values()];
}

// src/engine/sprite/npcPalette.ts
var HEX6 = /^#([0-9a-f]{6})$/i;
function toHsl(hex) {
  const match = HEX6.exec(hex.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  const r = (n >> 16 & 255) / 255;
  const g = (n >> 8 & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = max - min;
  const l = (max + min) / 2;
  if (c === 0) return { h: 0, s: 0, l };
  const sixth = max === r ? (g - b) / c % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return { h: (sixth * 60 + 360) % 360, s: c / (1 - Math.abs(2 * l - 1)), l };
}
function channels(h, c, x) {
  switch (Math.floor((h % 360 + 360) % 360 / 60) % 6) {
    case 0:
      return [c, x, 0];
    case 1:
      return [x, c, 0];
    case 2:
      return [0, c, x];
    case 3:
      return [0, x, c];
    case 4:
      return [x, 0, c];
    default:
      return [c, 0, x];
  }
}
function toHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(h / 60 % 2 - 1));
  const floor = l - c / 2;
  const [r, g, b] = channels(h, c, x);
  const byte = (v) => Math.max(0, Math.min(255, Math.round((v + floor) * 255)));
  return `#${(1 << 24 | byte(r) << 16 | byte(g) << 8 | byte(b)).toString(16).slice(1)}`;
}
function mix(hex, toward, amount) {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const ch = (shift) => {
    const va = a >> shift & 255;
    const vb = b >> shift & 255;
    return Math.round(va + (vb - va) * amount);
  };
  return `#${(1 << 24 | ch(16) << 16 | ch(8) << 8 | ch(0)).toString(16).slice(1)}`;
}
var WARM_ARC_END = 40;
var COOL_ARC_END = 250;
var turnDirection = (h) => h >= WARM_ARC_END && h < COOL_ARC_END ? 1 : -1;
var wrap = (h) => (h % 360 + 360) % 360;
function saturationFor(chroma, l) {
  const room = 1 - Math.abs(2 * l - 1);
  return room < 1e-4 ? 0 : Math.min(1, chroma / room);
}
var ACHROMATIC_S = 0.07;
var SHADOW_TINT_HUE = 228;
var WARM_TINT_HUE = 44;
var MIN_SHADE_CHROMA = 0.06;
var MIN_LIT_CHROMA = 0.045;
var SHADE_FLOOR_L = 0.045;
var LIT_CEIL_L = 0.96;
var LIGHT_RELIEF = 0.42;
var MAX_SAT_GAIN = 1.35;
function ramp(hex, t) {
  const hsl = toHsl(hex);
  if (!hsl) return { lit: hex, base: hex, shade: hex };
  const { h, s, l } = hsl;
  const chroma = s * (1 - Math.abs(2 * l - 1));
  const achromatic = s < ACHROMATIC_S;
  const dir = t.turnDir ?? turnDirection(h);
  const shadeL = Math.max(SHADE_FLOOR_L, l * (1 - t.drop * (1 - LIGHT_RELIEF * l)));
  const litL = Math.min(LIT_CEIL_L, l + (LIT_CEIL_L - l) * t.climb);
  const shadeH = achromatic ? SHADOW_TINT_HUE : wrap(h + dir * t.shadeTurn);
  const litH = achromatic ? WARM_TINT_HUE : wrap(h - dir * t.litTurn);
  const carry = (target, toneL, floor) => Math.min(
    1,
    Math.max(
      Math.min(saturationFor(target, toneL), s * MAX_SAT_GAIN),
      saturationFor(floor, toneL)
    )
  );
  return {
    lit: toHex({ h: litH, s: carry(chroma * t.litChroma, litL, MIN_LIT_CHROMA), l: litL }),
    base: hex,
    shade: toHex({
      h: shadeH,
      s: carry(chroma * t.shadeChroma, shadeL, MIN_SHADE_CHROMA),
      l: shadeL
    })
  };
}
var CLOTH = {
  drop: 0.46,
  climb: 0.2,
  shadeTurn: 14,
  litTurn: 11,
  shadeChroma: 1.08,
  litChroma: 0.92
};
var LEATHER = {
  drop: 0.55,
  climb: 0.22,
  shadeTurn: 14,
  litTurn: 12,
  shadeChroma: 1,
  litChroma: 0.85
};
var SKIN2 = {
  drop: 0.4,
  climb: 0.26,
  shadeTurn: 13,
  litTurn: 12,
  shadeChroma: 1.12,
  litChroma: 0.84,
  turnDir: -1
};
var HAIR2 = {
  drop: 0.45,
  climb: 0.16,
  shadeTurn: 15,
  litTurn: 10,
  shadeChroma: 1.06,
  litChroma: 0.88
};
var PROP = {
  drop: 0.6,
  climb: 0.24,
  shadeTurn: 16,
  litTurn: 13,
  shadeChroma: 1,
  litChroma: 0.86
};
var NPC_SKINS = {
  pale: "#f0d8c8",
  fair: "#e5c29d",
  olive: "#cdab7e",
  tan: "#b8895c",
  brown: "#8f603c",
  deep: "#5d3b28",
  /** Wind-burnt: a caretaker, a man who drinks outside the shop. */
  ruddy: "#dda78c",
  /** Yellowed, indoor, twenty a day. */
  sallow: "#cdbc94"
};
var NPC_HAIRS = {
  /** Blue-black. Warm black is the tell of a sepia palette. */
  black: "#1f212b",
  brown: "#4b3524",
  chestnut: "#6d4327",
  blond: "#c3a35d",
  ginger: "#ae5628",
  grey: "#8a8a90",
  white: "#d9d8d6",
  /** Dishwater blond that has started to go. */
  ash: "#a89f96",
  /** A home peroxide job with the roots still showing. */
  bleach: "#e0cf9a"
};
var NPC_FABRICS = {
  /** Tracksuit navy, three stripes down the leg. */
  navy: "#243a63",
  /** Faded, not new — the blue that has been through a hundred washes. */
  denim: "#5c7391",
  sky: "#87a9c8",
  /** Oxidised copper, the green of a church roof. */
  teal: "#2e7d74",
  /** Bottle green. */
  forest: "#2d5236",
  /** Army surplus. */
  olive: "#5b6235",
  mustard: "#c69a33",
  rust: "#a4522a",
  /** Oxblood. */
  maroon: "#6d2a2d",
  red: "#b23129",
  plum: "#682f5d",
  pink: "#c98a92",
  cream: "#dcd3b8",
  white: "#e9e8e6",
  /** Ash grey, the colour of everything on a stairwell. */
  grey: "#888c92",
  charcoal: "#383d46",
  /** Blue-black, the way dyed cotton actually sits in daylight. */
  black: "#262a33",
  brown: "#66452a",
  /** Roadworks yellow. Stays loud in shadow, which is the whole point of it. */
  hiVis: "#d6e23f",
  green: "#4a8a4a",
  /** The block itself. */
  brick: "#9c5240",
  khaki: "#8b8058",
  slate: "#4e5966",
  sand: "#c9b489",
  wine: "#5e2434",
  copper: "#b0703a",
  lilac: "#9b8fb5",
  moss: "#5f7042",
  steel: "#6f7d8c"
};
var fabric = (name) => NPC_FABRICS[name] ?? name;
var OCCLUSION = "#0d0f17";
var SMOKE = "#b6bac4";
var EMBER = "#f08236";
var DEFAULT_EYE = "#2b3239";
function npcPalette(look = {}) {
  const skin = ramp(NPC_SKINS[look.skin ?? "fair"], SKIN2);
  const hair = ramp(NPC_HAIRS[look.hair ?? "brown"], HAIR2);
  const top = ramp(fabric(look.topColour ?? "grey"), CLOTH);
  const bottom = ramp(fabric(look.bottomColour ?? "charcoal"), CLOTH);
  const shoes = ramp(fabric(look.shoeColour ?? "black"), LEATHER);
  const accent = ramp(fabric(look.accentColour ?? "cream"), CLOTH);
  const hat = ramp(fabric(look.hatColour ?? "navy"), CLOTH);
  const prop = ramp(fabric(look.propColour ?? "cream"), PROP);
  const beard = ramp(mix(hair.base, skin.base, 0.35), HAIR2);
  return {
    s: skin.base,
    S: skin.shade,
    y: skin.lit,
    h: hair.base,
    H: hair.shade,
    i: hair.lit,
    e: fabric(look.eyes ?? DEFAULT_EYE),
    f: beard.base,
    F: beard.shade,
    t: top.base,
    T: top.shade,
    l: top.lit,
    a: accent.base,
    A: accent.shade,
    g: accent.lit,
    p: bottom.base,
    q: bottom.shade,
    m: bottom.lit,
    b: shoes.base,
    B: shoes.shade,
    k: hat.base,
    K: hat.shade,
    j: hat.lit,
    c: prop.base,
    n: prop.shade,
    d: OCCLUSION,
    w: SMOKE,
    o: EMBER
  };
}

// src/engine/sprite/npcBuilder.ts
function shadeTorso(map, build) {
  const { sh } = anatomy(build);
  const litFrom = CENTRE - sh + 1;
  const litTo = CENTRE - sh + 2;
  const flankFrom = CENTRE + sh - 3;
  const flankTo = CENTRE + sh - 2;
  return map.map((r, y) => {
    const cells = [...r];
    const swap = (x, from, to) => {
      if (cells[x] === from) cells[x] = to;
    };
    for (let x = litFrom; x <= litTo; x++) swap(x, "t", "l");
    for (let x = flankFrom; x <= flankTo; x++) swap(x, "t", "T");
    if (y <= 1) for (let x = CENTRE - 2; x <= CENTRE + 1; x++) swap(x, "t", "d");
    if (y <= 1) {
      swap(CENTRE - sh, "t", "T");
      swap(CENTRE + sh - 1, "t", "T");
    }
    return cells.join("");
  });
}
function torsoFront(build) {
  const { sh, wa } = anatomy(build);
  const rows = [];
  rows.push(shell(CENTRE, sh - 2, "t", "T"));
  for (let i = 0; i < 5; i++) rows.push(shell(CENTRE, sh, "t", "T"));
  rows.push(shell(CENTRE, sh - 1, "t", "T"));
  rows.push(shell(CENTRE, sh - 1, "t", "T"));
  for (let i = 0; i < 3; i++) rows.push(shell(CENTRE, wa + 1, "t", "T"));
  for (let i = 0; i < 4; i++) rows.push(shell(CENTRE, wa, "t", "T"));
  return rows.slice(0, TORSO_ROWS);
}
function torsoProfile(build) {
  const { sh, wa } = anatomy(build);
  const half = Math.max(3, sh - 2);
  const hip = Math.max(3, wa - 1);
  const rows = [];
  rows.push(shell(CENTRE, half - 1, "t", "T"));
  for (let i = 0; i < 8; i++) rows.push(shell(CENTRE, half, "t", "T"));
  for (let i = 0; i < 3; i++) rows.push(shell(CENTRE, hip + 1, "t", "T"));
  for (let i = 0; i < 3; i++) rows.push(shell(CENTRE, hip, "t", "T"));
  return rows.slice(0, TORSO_ROWS);
}
function legs(build, opts = {}) {
  const { wa, legW } = anatomy(build);
  const stride = opts.stride ?? 0;
  const spread = opts.gap ?? 0;
  const L = CENTRE - wa - spread;
  const R = CENTRE + wa - legW + spread;
  const rows = [];
  rows.push(shell(CENTRE, wa, "p", "q"));
  rows.push(shell(CENTRE, wa, "p", "q"));
  const near = (w) => "m" + "p".repeat(Math.max(0, w - 2)) + "q";
  for (let i = 0; i < 5; i++) rows.push(row([L, near(legW)], band(R, legW, "q")));
  for (let i = 0; i < 6; i++) {
    const lean = Math.round(stride * (i + 1) / 6);
    rows.push(row([L - lean, near(legW)], band(R + lean, legW, "q")));
  }
  rows.push(row(band(L - stride, legW, "s"), band(R + stride, legW, "s")));
  rows.push(row(band(L - stride - 1, legW + 1, "b"), band(R + stride, legW + 1, "b")));
  rows.push(row(band(L - stride - 1, legW + 1, "B"), band(R + stride, legW + 1, "B")));
  return rows.slice(0, LEG_ROWS);
}
function legColumns(build, r, opts = {}) {
  const { wa, legW } = anatomy(build);
  const stride = opts.stride ?? 0;
  const spread = opts.gap ?? 0;
  const shin = r >= 7 && r <= 12 ? Math.round(stride * (r - 6) / 6) : r >= 13 ? stride : 0;
  return {
    legW,
    L: CENTRE - wa - spread - shin,
    R: CENTRE + wa - legW + spread + shin
  };
}
function legsProfile(build, opts = {}) {
  const { wa, legW } = anatomy(build);
  const stride = opts.stride ?? 0;
  const hip = Math.max(3, wa - 1);
  const x = CENTRE - Math.floor(legW / 2);
  const bare = opts.bareFrom ?? Number.POSITIVE_INFINITY;
  const near = (r) => r >= bare ? "s" : "p";
  const far = (r) => r >= bare ? "S" : "q";
  const rows = [];
  rows.push(shell(CENTRE, hip, "p", "q"));
  rows.push(shell(CENTRE, hip, "p", "q"));
  for (let i = 0; i < 4; i++) {
    const lean = Math.round(stride * (i + 1) / 8);
    const r = i + 2;
    rows.push(row(band(x - lean, legW, far(r)), band(x + lean, legW, near(r))));
  }
  for (let i = 0; i < 7; i++) {
    const lean = Math.round(stride * (i + 5) / 8);
    const r = i + 6;
    rows.push(row(band(x - lean, legW, far(r)), band(x + lean, legW, near(r))));
  }
  const toe = Math.round(stride);
  rows.push(row(band(x - toe, legW, "S"), band(x + toe, legW, "s")));
  rows.push(row(band(x - toe - 1, legW + 1, "B"), band(x + toe, legW + 2, "b")));
  rows.push(row(band(x - toe - 1, legW + 1, "B"), band(x + toe, legW + 2, "B")));
  return rows.slice(0, LEG_ROWS);
}
var SIT_ROWS = 9;
function legsSit(build) {
  const { wa, legW } = anatomy(build);
  const knee = CENTRE + wa + 1;
  const shinX = knee - legW + 1;
  const rows = [];
  const thigh = knee - (CENTRE - wa) + 1;
  rows.push(row(band(CENTRE - wa, thigh, "p")));
  rows.push(row(band(CENTRE - wa, thigh, "p")));
  rows.push(row(band(CENTRE - wa, thigh, "q")));
  const farX = shinX - legW - 1;
  for (let i = 0; i < 4; i++) {
    rows.push(row(band(farX, legW, "q"), band(shinX, legW, i === 3 ? "q" : "p")));
  }
  rows.push(row(band(farX, legW, "S"), band(shinX, legW, "s")));
  rows.push(row(band(farX - 1, legW + 1, "B"), band(shinX, legW + 1, "B")));
  return rows.slice(0, SIT_ROWS);
}
var SLEEVE = {
  tshirt: "short",
  shirt: "long",
  jumper: "long",
  hoodie: "long",
  jacket: "long",
  coat: "long",
  dress: "short",
  tracksuit: "long",
  overalls: "short",
  tank: "bare"
};
function topDetail(kind, build) {
  const { sh, wa } = anatomy(build);
  const out = [];
  const collar = (zone) => ({
    r: 0,
    c: CENTRE - 3,
    rows: [zone.repeat(6), `.${zone}ss${zone}.`]
  });
  switch (kind) {
    case "shirt":
      out.push(collar("T"));
      out.push({ r: 1, c: CENTRE - 1, rows: ["T.", "T.", "T.", "T.", "T.", "T.", "T.", "T."] });
      out.push({ r: 2, c: CENTRE, rows: ["c"] }, { r: 5, c: CENTRE, rows: ["c"] });
      out.push({ r: 8, c: CENTRE, rows: ["c"] });
      break;
    case "jumper":
      out.push(collar("T"));
      out.push({ r: 13, c: CENTRE - wa, rows: ["T".repeat(wa * 2)] });
      break;
    case "hoodie":
      out.push({ r: 0, c: CENTRE - 4, rows: ["TTTTTTTT", ".TTTTTT."] });
      out.push({ r: 9, c: CENTRE - 3, rows: ["TTTTTT", "T....T"] });
      break;
    case "jacket":
      out.push(collar("T"));
      out.push({ r: 1, c: CENTRE - 3, rows: ["TT..TT", "TT..TT", ".T..T."] });
      out.push({ r: 1, c: CENTRE, rows: ["T", "T", "T", "T", "T", "T", "T", "T", "T", "T"] });
      break;
    case "coat":
      out.push({ r: 0, c: CENTRE - 4, rows: ["TTTTTTTT"] });
      out.push({ r: 1, c: CENTRE, rows: Array.from({ length: 13 }, () => "T") });
      out.push({ r: 3, c: CENTRE + 1, rows: ["c"] }, { r: 7, c: CENTRE + 1, rows: ["c"] });
      break;
    case "dress":
      out.push({ r: 11, c: CENTRE - wa - 1, rows: ["a".repeat(wa * 2 + 2)] });
      out.push({ r: 12, c: CENTRE - wa - 1, rows: ["a".repeat(wa * 2 + 2)] });
      out.push({ r: 13, c: CENTRE - wa - 2, rows: ["a".repeat(wa * 2 + 4)] });
      out.push({ r: 14, c: CENTRE - wa - 2, rows: ["A".repeat(wa * 2 + 4)] });
      break;
    case "tracksuit":
      out.push({ r: 1, c: CENTRE - sh, rows: Array.from({ length: 6 }, () => "a") });
      out.push({ r: 1, c: CENTRE + sh - 1, rows: Array.from({ length: 6 }, () => "a") });
      out.push(collar("T"));
      break;
    case "overalls":
      out.push({ r: 0, c: CENTRE - 3, rows: ["a....a", "a....a"] });
      out.push({ r: 5, c: CENTRE - wa, rows: ["a".repeat(wa * 2)] });
      out.push({ r: 6, c: CENTRE - wa, rows: ["a".repeat(wa * 2)] });
      out.push({ r: 7, c: CENTRE - 2, rows: ["A".repeat(4)] });
      break;
    case "tank":
      out.push({ r: 0, c: CENTRE - 4, rows: ["ss....ss", "ss....ss"] });
      break;
    default:
      out.push(collar("T"));
  }
  return out;
}
function bottomDetail(kind, build, stance = {}) {
  const { wa } = anatomy(build);
  const out = [];
  const at = (r) => legColumns(build, r, stance);
  switch (kind) {
    case "jeans":
      for (let r = 2; r <= 10; r++) out.push({ r, c: at(r).L + 1, rows: ["q"] });
      out.push({ r: 12, c: at(12).L, rows: ["q".repeat(at(12).legW)] });
      break;
    case "skirt":
      out.push({ r: 0, c: CENTRE - wa - 1, rows: ["p".repeat(wa * 2 + 2)] });
      out.push({ r: 1, c: CENTRE - wa - 1, rows: ["p".repeat(wa * 2 + 2)] });
      out.push({ r: 2, c: CENTRE - wa - 2, rows: ["p".repeat(wa * 2 + 4)] });
      out.push({ r: 3, c: CENTRE - wa - 2, rows: ["q".repeat(wa * 2 + 4)] });
      break;
    case "shorts":
      out.push({ r: 4, c: at(4).L, rows: ["q".repeat(at(4).legW)] });
      out.push({ r: 4, c: at(4).R, rows: ["q".repeat(at(4).legW)] });
      for (let r = 5; r < 11; r++) {
        const { L, R, legW: w } = at(r);
        out.push({ r, c: L, rows: ["s".repeat(w)] });
        out.push({ r, c: R, rows: ["S".repeat(w)] });
      }
      break;
    case "workpants":
      for (let r = 4; r <= 6; r++) out.push({ r, c: at(r).L, rows: ["qq"] });
      break;
    case "tracksuit":
      for (let r = 0; r <= 11; r++) out.push({ r, c: at(r).L, rows: ["a"] });
      break;
    default:
      break;
  }
  return out;
}
function shoeDetail(kind, build, stance = {}) {
  const foot = (r) => {
    const { L, R, legW } = legColumns(build, r, stance);
    return { L: L - 1, R, w: legW + 1, legW };
  };
  switch (kind) {
    case "boots":
      return [11, 12, 13].flatMap((r) => {
        const f = foot(r);
        return [
          { r, c: f.L + 1, rows: ["b".repeat(f.legW)] },
          { r, c: f.R, rows: ["b".repeat(f.legW)] }
        ];
      });
    case "trainers": {
      const f = foot(15);
      return [
        { r: 15, c: f.L, rows: ["c".repeat(f.w)] },
        { r: 15, c: f.R, rows: ["c".repeat(f.w)] }
      ];
    }
    case "heels": {
      const f = foot(15);
      return [
        { r: 15, c: f.L, rows: [`${"B".repeat(f.w - 1)}.`] },
        { r: 15, c: f.R, rows: [`.${"B".repeat(f.w - 1)}`] }
      ];
    }
    case "sandals": {
      const f = foot(13);
      return [
        { r: 13, c: f.L + 1, rows: ["s".repeat(f.legW)] },
        { r: 13, c: f.R, rows: ["s".repeat(f.legW)] }
      ];
    }
    default:
      return [];
  }
}
function accentPatchFor(kind, build) {
  const { sh, wa } = anatomy(build);
  const bodyW = sh * 2;
  const waistW = wa * 2;
  switch (kind) {
    case "apron":
      return [
        { r: 3, c: CENTRE - 2, rows: ["aaaa"] },
        {
          r: 8,
          c: CENTRE - wa,
          rows: Array.from(
            { length: 7 },
            (_, i) => i === 6 ? "A".repeat(waistW) : "a".repeat(waistW)
          )
        }
      ];
    case "vest":
      return [
        {
          r: 1,
          c: CENTRE - sh + 1,
          rows: Array.from({ length: 10 }, () => "a".repeat(Math.max(2, bodyW - 2)))
        },
        { r: 1, c: CENTRE, rows: Array.from({ length: 10 }, () => "A") },
        { r: 4, c: CENTRE - sh + 1, rows: ["c".repeat(Math.max(2, bodyW - 2))] },
        { r: 8, c: CENTRE - sh + 1, rows: ["c".repeat(Math.max(2, bodyW - 2))] }
      ];
    case "scarf":
      return [
        { r: 0, c: CENTRE - wa, rows: ["a".repeat(waistW), `.${"a".repeat(waistW - 2)}.`] },
        { r: 2, c: CENTRE + 1, rows: ["aa", "aa", "aA"] }
      ];
    case "tie":
      return [{ r: 1, c: CENTRE - 1, rows: ["aa", "aa", "aa", "aa", "aa", "AA"] }];
    case "shawl":
      return [
        {
          r: 0,
          c: CENTRE - sh,
          rows: ["a".repeat(bodyW), "a".repeat(bodyW), `.${"a".repeat(bodyW - 2)}.`]
        },
        { r: 3, c: CENTRE - 2, rows: ["Aaaa"] }
      ];
    case "lanyard":
      return [
        { r: 0, c: CENTRE - 2, rows: ["a...a", ".a.a.", "..a.."] },
        { r: 3, c: CENTRE - 1, rows: ["cc", "cc"] }
      ];
    case "backpack":
      return [
        {
          r: 1,
          c: CENTRE - sh,
          rows: Array.from({ length: 8 }, () => `a${".".repeat(bodyW - 2)}a`)
        },
        { r: 1, c: CENTRE + sh, rows: Array.from({ length: 8 }, () => "a") },
        { r: 9, c: CENTRE + sh, rows: ["A"] }
      ];
    case "belt":
      return [
        { r: 12, c: CENTRE - wa, rows: ["a".repeat(waistW)] },
        { r: 12, c: CENTRE, rows: ["c"] }
      ];
  }
}
function texturize(map, kind, from, to) {
  if (kind === "none") return [...map];
  const hit = (x, y) => {
    switch (kind) {
      case "stripe":
        return y % 3 === 0;
      case "pinstripe":
        return x % 3 === 0;
      case "check":
        return x % 4 === 0 && y % 2 === 0;
      case "knit":
        return y % 2 === 0 && (x + y) % 4 === 0;
      case "worn":
        return (x * 7 + y * 13) % 11 === 0;
      case "flecked":
        return (x * 5 + y * 3) % 7 === 0;
      default:
        return false;
    }
  };
  return map.map((r, y) => [...r].map((ch, x) => ch === from && hit(x, y) ? to : ch).join(""));
}
function propCells(kind, a, hand) {
  const floor = a.floorY;
  switch (kind) {
    case "mop":
      return [
        ...stroke(hand.x, hand.y - 6, hand.x, floor - 2, "n", 1),
        { x: hand.x - 1, y: floor - 1, z: "c" },
        { x: hand.x, y: floor - 1, z: "c" },
        { x: hand.x + 1, y: floor - 1, z: "c" },
        { x: hand.x - 1, y: floor, z: "c" },
        { x: hand.x, y: floor, z: "n" },
        { x: hand.x + 1, y: floor, z: "c" }
      ];
    case "broom":
      return [
        ...stroke(hand.x, hand.y - 6, hand.x, floor - 1, "n", 1),
        { x: hand.x - 1, y: floor, z: "n" },
        { x: hand.x, y: floor, z: "c" },
        { x: hand.x + 1, y: floor, z: "n" }
      ];
    case "cane":
      return stroke(hand.x, hand.y, hand.x + 1, floor, "n", 1);
    case "umbrella":
      return [
        ...stroke(hand.x, hand.y - 2, hand.x, floor, "n", 1),
        { x: hand.x - 2, y: hand.y - 3, z: "c" },
        { x: hand.x - 1, y: hand.y - 3, z: "c" },
        { x: hand.x, y: hand.y - 3, z: "c" },
        { x: hand.x + 1, y: hand.y - 3, z: "c" },
        { x: hand.x + 2, y: hand.y - 3, z: "c" }
      ];
    case "bag":
      return [
        { x: hand.x, y: hand.y + 1, z: "n" },
        { x: hand.x + 2, y: hand.y + 1, z: "n" },
        ...[2, 3, 4, 5].flatMap(
          (dy) => [0, 1, 2].map((dx) => ({ x: hand.x + dx, y: hand.y + dy, z: dy === 5 ? "n" : "c" }))
        )
      ];
    case "shopping":
      return [
        { x: hand.x, y: hand.y + 1, z: "n" },
        { x: hand.x + 2, y: hand.y + 1, z: "n" },
        ...[2, 3, 4, 5, 6].flatMap(
          (dy) => [0, 1, 2].map((dx) => ({
            x: hand.x + dx,
            y: hand.y + dy,
            z: dy === 3 && dx === 1 ? "n" : "c"
          }))
        )
      ];
    case "phone":
      return [
        { x: hand.x, y: hand.y - 1, z: "n" },
        { x: hand.x + 1, y: hand.y - 1, z: "n" },
        { x: hand.x, y: hand.y, z: "c" },
        { x: hand.x + 1, y: hand.y, z: "c" }
      ];
    case "coffee":
      return [
        { x: hand.x, y: hand.y - 2, z: "c" },
        { x: hand.x + 1, y: hand.y - 2, z: "c" },
        { x: hand.x, y: hand.y - 1, z: "c" },
        { x: hand.x + 1, y: hand.y - 1, z: "n" }
      ];
    case "bottle":
      return [
        { x: hand.x, y: hand.y - 4, z: "n" },
        { x: hand.x, y: hand.y - 3, z: "c" },
        { x: hand.x, y: hand.y - 2, z: "c" },
        { x: hand.x + 1, y: hand.y - 2, z: "c" },
        { x: hand.x, y: hand.y - 1, z: "c" },
        { x: hand.x + 1, y: hand.y - 1, z: "c" }
      ];
    case "newspaper":
    case "clipboard":
      return [0, 1, 2, 3].flatMap(
        (dy) => [0, 1, 2].map((dx) => ({
          x: hand.x + dx - 1,
          y: hand.y + dy - 2,
          z: dy === 1 && dx === 1 || kind === "clipboard" && dy === 0 ? "n" : "c"
        }))
      );
    case "cigarette":
      return [
        { x: hand.x + 1, y: hand.y, z: "c" },
        { x: hand.x + 2, y: hand.y, z: "o" }
      ];
    case "keys":
      return [
        { x: hand.x, y: hand.y + 1, z: "n" },
        { x: hand.x, y: hand.y + 2, z: "c" },
        { x: hand.x + 1, y: hand.y + 2, z: "c" }
      ];
    case "flowers":
      return [
        ...stroke(hand.x, hand.y - 4, hand.x, hand.y, "n", 1),
        { x: hand.x - 1, y: hand.y - 5, z: "a" },
        { x: hand.x, y: hand.y - 6, z: "a" },
        { x: hand.x + 1, y: hand.y - 5, z: "a" },
        { x: hand.x, y: hand.y - 5, z: "c" }
      ];
  }
}
var PROP_ARM = {
  mop: ARM.workLow,
  broom: ARM.workLow,
  cane: ARM.carry,
  umbrella: ARM.carry,
  bag: ARM.carry,
  shopping: ARM.carry,
  phone: ARM.toFace,
  coffee: ARM.hold,
  bottle: ARM.hold,
  newspaper: ARM.hold,
  clipboard: ARM.hold,
  cigarette: ARM.toFace,
  keys: ARM.rest,
  flowers: ARM.hold
};
function applyPatches(map, patches) {
  let out = [...map];
  for (const p of patches) if (p) out = patchInto(out, p);
  return out;
}
function patchInto(map, patch) {
  const out = map.map((r) => r.split(""));
  patch.rows.forEach((prow, dr) => {
    [...prow].forEach((ch, dc) => {
      if (ch === "." || ch === " ") return;
      const rr = patch.r + dr;
      const cc = patch.c + dc;
      if (out[rr] && cc >= 0 && cc < out[rr].length) out[rr][cc] = ch;
    });
  });
  return out.map((r) => r.join(""));
}
function bow(map, depth = 1) {
  const empty = ".".repeat(W2);
  return [
    ...Array.from({ length: depth }, () => empty),
    ...map.slice(0, HEAD_ROWS - depth),
    ...map.slice(HEAD_ROWS)
  ];
}
function raiseChin(map) {
  return [...map.slice(1, HEAD_ROWS), ".".repeat(W2), ...map.slice(HEAD_ROWS)];
}
function breathe(map, depth = 1) {
  const empty = ".".repeat(W2);
  const hips = HEAD_ROWS + TORSO_ROWS;
  return [
    ...Array.from({ length: depth }, () => empty),
    ...map.slice(0, hips - depth),
    ...map.slice(hips)
  ];
}
function rise(map) {
  const hips = HEAD_ROWS + TORSO_ROWS;
  return [...map.slice(1, hips), map[hips - 1], ...map.slice(hips)];
}
function sway(map, dx) {
  if (dx === 0) return [...map];
  return map.map(
    (r) => dx > 0 ? ".".repeat(dx) + r.slice(0, W2 - dx) : r.slice(-dx) + ".".repeat(-dx)
  );
}
function mirrorHead(map) {
  return map.map((r, i) => i <= HEAD_ROWS - 1 ? [...r].reverse().join("") : r);
}
function shorten(map, n) {
  if (n <= 0) return [...map];
  const empty = ".".repeat(W2);
  const painted = (r) => /[^.]/.test(r);
  if (map.length && !painted(map[map.length - 1])) {
    const take = Math.min(n, 2);
    const seated = [...map];
    seated.splice(HEAD_ROWS + 8, take);
    return [...seated, ...Array.from({ length: take }, () => empty)];
  }
  const cut = HEAD_ROWS + TORSO_ROWS + 8;
  const out = [...map];
  out.splice(cut, n);
  return [...Array.from({ length: n }, () => empty), ...out];
}
var FX_ZONES = {
  /** a fresh plume, the second after an exhale */
  w: "#f2eee6e6",
  /** the tail of it, thinning into the air */
  W: "#e6e0d4a0",
  /** water on a floor, and what runs off a mop when it comes out of a bucket */
  v: "#9fc4d0cc"
};
function createNpc(spec) {
  const build = spec.build ?? "regular";
  const height = spec.height ?? "average";
  const look = spec.look ?? {};
  const doing = spec.doing ?? "standing";
  const palette = { ...npcPalette(look), ...FX_ZONES, ...spec.palette ?? {} };
  const a = anatomy(build);
  const sleeve = SLEEVE[look.top ?? "tshirt"];
  const b = createCharacter({ palette, cell: spec.cell ?? 2, walkSpeed: spec.walkSpeed ?? 46 });
  const traits = faceFor(spec.id, {
    shape: look.head,
    brow: look.brow,
    eyes: look.eyeShape,
    nose: look.nose,
    mouth: look.mouth,
    ears: look.ears
  });
  const skull = skullOf(traits.shape);
  const features = look.face ? Array.isArray(look.face) ? [...look.face] : [look.face] : [];
  const geo = faceGeometry(traits);
  const hair = hairCells(look.hairStyle ?? "short", geo);
  const hat = look.hat && look.hat !== "none" ? hatCells(look.hat, geo) : [];
  const accentPatches = look.accent && look.accent !== "none" ? accentPatchFor(look.accent, build) : [];
  const sheen = { r: 0, c: CENTRE - 3, rows: ["ii"] };
  const clipCrown = (head) => {
    const l = CENTRE - skull.skull - 1;
    const r = CENTRE + skull.skull;
    return head.map((line) => [...line].map((c, x) => x < l || x > r ? "." : c).join(""));
  };
  const dress = (head, view) => {
    let out = stamp(head, hair);
    if (hat.length === 0) out = applyPatches(out, [sheen]);
    out = clipCrown(stamp(out, hat));
    out = stamp(
      out,
      features.flatMap((f) => featureCells(f, traits, view))
    );
    return features.length > 0 ? stamp(out, mouthCells(traits, view)) : out;
  };
  const texture = look.texture ?? "none";
  const dressTorso = (torso) => shadeTorso(
    texturize(
      applyPatches(torso, [...topDetail(look.top ?? "tshirt", build), ...accentPatches]),
      texture,
      "t",
      "T"
    ),
    build
  );
  const dressLegs = (l, stance = {}) => texturize(
    applyPatches(l, [
      ...bottomDetail(look.bottom ?? "trousers", build, stance),
      ...shoeDetail(look.shoes ?? "shoes", build, stance)
    ]),
    // a fine weave belongs on a jumper, not on a trouser leg
    texture === "knit" || texture === "flecked" ? "none" : texture,
    "p",
    "q"
  );
  const dressTorsoSide = (torso) => {
    const silhouette = torso;
    return dressTorso(torso).map(
      (r, y) => [...r].map((c, x) => silhouette[y]?.[x] === "." ? "." : c).join("")
    );
  };
  b.part("head", dress(headFront(traits), "front"));
  b.part("headSide", dress(headProfile(traits), "side"));
  b.part("torso", dressTorso(torsoFront(build)));
  b.part("torsoSide", dressTorsoSide(torsoProfile(build)));
  b.part("legs", dressLegs(legs(build)));
  b.part("legsApart", dressLegs(legs(build, { gap: 1 }), { gap: 1 }));
  b.part("legsStride", dressLegs(legs(build, { stride: 3 }), { stride: 3 }));
  b.part("legsPass", dressLegs(legs(build, { stride: -1 }), { stride: -1 }));
  b.part("legsSit", texturize(legsSit(build), texture === "knit" ? "none" : texture, "p", "q"));
  const bareFrom = look.bottom === "shorts" ? 6 : void 0;
  b.part(
    "legsSideStride",
    texturize(legsProfile(build, { stride: 3, bareFrom }), "none", "p", "q")
  );
  b.part("legsSidePass", texturize(legsProfile(build, { stride: 0, bareFrom }), "none", "p", "q"));
  b.part("legsWeight", dressLegs(legs(build, { stride: 1 }), { stride: 1 }));
  const prop = look.prop && look.prop !== "none" ? look.prop : null;
  const armOpts = { sleeve, cloth: "t", shade: "T", skin: "s" };
  const farArm = { ...armOpts, cloth: "T", shade: "T", skin: "S" };
  const withArms = (left, right, opts = {}) => (m) => {
    const cells = [...arm(a, -1, left, farArm), ...arm(a, 1, right, armOpts)];
    let out = stamp(m, cells);
    if (prop && opts.carry !== false) {
      out = stamp(out, propCells(prop, a, handAt(a, 1, right)));
      out = stamp(out, arm(a, 1, right, armOpts).slice(-6));
    }
    return out;
  };
  const holding = (fallback) => prop ? PROP_ARM[prop] ?? fallback : fallback;
  const withSideArms = (near, far) => (m) => {
    let out = stamp(m, arm(a, 1, far, { ...farArm, at: a.shoulderSide - 1 }));
    out = stamp(out, arm(a, 1, near, { ...armOpts, at: a.shoulderSide + 1 }));
    if (prop) {
      out = stamp(out, propCells(prop, a, handAt(a, 1, near, a.shoulderSide + 1)));
      out = stamp(out, arm(a, 1, near, { ...armOpts, at: a.shoulderSide + 1 }).slice(-6));
    }
    return out;
  };
  const front = (legPart) => (f) => f.stack("head", "torso", legPart);
  const side = (legPart) => (f) => f.stack("headSide", "torsoSide", legPart);
  b.frame("stand", (f) => front("legs")(f).map(withArms(ARM.rest, holding(ARM.rest))));
  b.variant("breathe", "stand", (m) => breathe(m));
  b.variant("blink", "stand", (m) => replaceColor(m, "e", "s"));
  b.variant("lookBack", "stand", (m) => mirrorHead(m));
  b.frame(
    "weight",
    (f) => front("legsWeight")(f).map(withArms(ARM.rest, holding(ARM.rest))).map((m) => sway(m, 1))
  );
  b.variant("weightB", "weight", (m) => breathe(m));
  b.variant("nod", "stand", (m) => bow(m, 1));
  b.frame("talkA", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.talk)));
  b.frame("talkB", (f) => front("legs")(f).map(withArms(ARM.talkWide, ARM.rest)));
  b.variant("talkC", "talkA", (m) => breathe(m));
  b.variant("talkTilt", "talkB", (m) => mirrorHead(bow(m, 1)));
  b.frame("waveA", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.waveUp)));
  b.frame("waveB", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.waveOut)));
  b.frame("shrug", (f) => front("legs")(f).map(withArms(ARM.shrug, ARM.shrug)));
  b.frame("point", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.point)));
  b.frame("pockets", (f) => front("legs")(f).map(withArms(ARM.pocket, ARM.pocket)));
  b.frame("fold", (f) => front("legsApart")(f).map(withArms(ARM.foldOver, ARM.foldUnder)));
  b.variant("foldB", "fold", (m) => breathe(m));
  b.frame("scratchHead", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.behindHead)));
  b.variant("scratchHeadB", "scratchHead", (m) => mirrorHead(m));
  b.frame("hail", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.hail)));
  b.frame("offer", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.offer)));
  b.frame(
    "count",
    (f) => front("legs")(f).map(withArms(ARM.count, ARM.count)).map((m) => bow(m, 1))
  );
  b.frame("toMouth", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.toMouth)));
  b.variant("toMouthUp", "toMouth", (m) => raiseChin(m));
  b.frame(
    "checkPhone",
    (f) => front("legs")(f).map(withArms(ARM.rest, ARM.hold)).map((m) => bow(m, 1))
  );
  b.variant("laughA", "stand", (m) => raiseChin(m));
  b.variant("laughB", "stand", (m) => bow(raiseChin(m), 1));
  b.variant("coughA", "toMouth", (m) => bow(m, 1));
  b.variant("coughB", "toMouth", (m) => bow(m, 2));
  b.variant("lookL", "stand", (m) => mirrorHead(m));
  b.variant("lookR", "weight", (m) => mirrorHead(m));
  b.frame("walkA", (f) => side("legsSideStride")(f).map(withSideArms(ARM.swingFwd, ARM.swingBack)));
  b.frame("walkB", (f) => side("legsSidePass")(f).map(withSideArms(ARM.rest, ARM.rest)));
  b.frame("walkC", (f) => side("legsSideStride")(f).map(withSideArms(ARM.swingBack, ARM.swingFwd)));
  b.variant("walkD", "walkB", (m) => breathe(m));
  b.variant("walkBUp", "walkB", (m) => rise(m));
  b.variant("walkDUp", "walkD", (m) => rise(m));
  b.frame(
    "standSide",
    (f) => side("legsSidePass")(f).map(withSideArms(holding(ARM.rest), ARM.rest))
  );
  b.walkCycle("walkA", "walkBUp", "walkC", "walkDUp");
  const actions = {
    /**
     * Standing about. Twenty seconds of it, because a six-second loop is a
     * loop you can see, and a person you can see looping is a prop.
     *
     * The shape of it: long stretches of nearly nothing — breath, a blink, the
     * weight going from one foot to the other — punctuated by one piece of
     * small business. Nobody stands still, and nobody does anything much
     * either. That is what waiting looks like.
     */
    idle: {
      frames: [
        "stand",
        "breathe",
        "stand",
        "blink",
        "stand",
        "breathe",
        "weight",
        "weightB",
        "weight",
        "stand",
        "lookBack",
        "stand",
        "breathe",
        "pockets",
        "pockets",
        "pockets",
        "stand",
        "blink",
        "weight",
        "weightB",
        "scratchHead",
        "scratchHeadB",
        "stand",
        "breathe",
        "stand",
        "lookL",
        "stand",
        "lookR",
        "weight",
        "stand",
        "checkPhone",
        "checkPhone",
        "checkPhone",
        "stand",
        "breathe",
        "fold",
        "foldB",
        "fold",
        "foldB",
        "stand",
        "blink",
        "breathe"
      ],
      frameMs: 620,
      loops: 1
    },
    talk: {
      frames: [
        "talkA",
        "stand",
        "talkB",
        "talkTilt",
        "nod",
        "stand",
        "talkA",
        "talkC",
        "stand",
        "talkB",
        "nod",
        "stand"
      ],
      frameMs: 300,
      loops: 1,
      interruptible: true
    },
    wave: { frames: ["waveA", "waveB", "waveA", "waveB", "stand"], frameMs: 260, loops: 1 },
    shrug: { frames: ["stand", "shrug", "shrug", "stand"], frameMs: 360, loops: 1 },
    notice: { frames: ["lookBack", "stand", "nod", "stand"], frameMs: 320, loops: 1 },
    point: { frames: ["stand", "point", "point", "talkA", "stand"], frameMs: 340, loops: 1 },
    walk: { frames: ["walkA", "walkBUp", "walkC", "walkDUp"], frameMs: 190, loops: 4 },
    // --- the library: everything a person does that is not standing still ---
    greet: {
      frames: ["lookBack", "stand", "hail", "waveA", "waveB", "waveA", "stand", "nod"],
      frameMs: 280,
      loops: 1
    },
    farewell: { frames: ["waveA", "waveB", "stand", "lookBack", "stand"], frameMs: 320, loops: 1 },
    laugh: {
      frames: ["laughA", "laughB", "laughA", "laughB", "laughA", "stand", "breathe"],
      frameMs: 190,
      loops: 1
    },
    cough: {
      frames: ["stand", "toMouth", "coughA", "coughB", "coughA", "toMouth", "stand", "breathe"],
      frameMs: 190,
      loops: 1
    },
    phone: {
      frames: [
        "stand",
        "checkPhone",
        "checkPhone",
        "checkPhone",
        "scratchHead",
        "checkPhone",
        "stand"
      ],
      frameMs: 520,
      loops: 1
    },
    drink: {
      frames: ["stand", "toMouth", "toMouthUp", "toMouthUp", "toMouth", "stand", "breathe"],
      frameMs: 400,
      loops: 1
    },
    handOver: { frames: ["stand", "offer", "offer", "offer", "stand"], frameMs: 340, loops: 1 },
    count: {
      frames: ["stand", "count", "count", "count", "count", "stand"],
      frameMs: 380,
      loops: 1
    },
    lookAround: {
      frames: ["stand", "lookL", "stand", "weight", "lookR", "weight", "stand", "breathe"],
      frameMs: 480,
      loops: 1
    },
    scratch: {
      frames: ["stand", "scratchHead", "scratchHeadB", "scratchHead", "stand"],
      frameMs: 340,
      loops: 1
    },
    show: {
      frames: ["stand", "point", "point", "talkA", "point", "stand"],
      frameMs: 340,
      loops: 1
    }
  };
  if (doing === "working") {
    b.frame("workA", (f) => front("legsApart")(f).map(withArms(ARM.workHigh, ARM.workLow)));
    b.frame("workB", (f) => front("legsApart")(f).map(withArms(ARM.workLow, ARM.workHigh)));
    b.variant("workC", "workA", (m) => breathe(m));
    b.frame("wipeBrow", (f) => front("legsApart")(f).map(withArms(ARM.workLow, ARM.toFace)));
    b.variant("wipeBrowB", "wipeBrow", (m) => bow(m, 1));
    b.frame("stretchBack", (f) => front("legsApart")(f).map(withArms(ARM.back, ARM.back)));
    b.variant("stretchBackB", "stretchBack", (m) => raiseChin(m));
    b.frame("leanProp", (f) => front("legsApart")(f).map(withArms(ARM.rest, ARM.workHigh)));
    b.variant("leanPropB", "leanProp", (m) => breathe(m));
    b.frame(
      "wring",
      (f) => front("legsApart")(f).map(withArms(ARM.workLow, ARM.workLow)).map((m) => bow(m, 1))
    );
    b.variant("wringB", "wring", (m) => breathe(m));
    actions.work = {
      frames: [
        "workA",
        "workB",
        "workC",
        "workB",
        "workA",
        "workB",
        "leanProp",
        "leanPropB",
        "wipeBrow",
        "wipeBrowB",
        "workA",
        "workB",
        "workC",
        "workB",
        "stretchBack",
        "stretchBackB",
        "stretchBack",
        "stand"
      ],
      frameMs: 430,
      loops: 1
    };
    actions.wring = {
      frames: ["stand", "wring", "wringB", "wring", "wringB", "wring", "stand"],
      frameMs: 380,
      loops: 1
    };
    actions.rest = {
      frames: ["leanProp", "leanPropB", "leanProp", "wipeBrow", "leanProp", "leanPropB"],
      frameMs: 620,
      loops: 1
    };
    actions.talkAtWork = {
      frames: ["leanProp", "talkA", "leanProp", "talkB", "nod", "leanProp", "talkA", "leanProp"],
      frameMs: 320,
      loops: 1,
      interruptible: true
    };
  }
  if (doing === "serving") {
    b.frame("serveHand", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.offer)));
    b.frame("serveTake", (f) => front("legs")(f).map(withArms(ARM.offer, ARM.rest)));
    b.frame(
      "serveTill",
      (f) => front("legs")(f).map(withArms(ARM.rest, ARM.workHigh)).map((m) => bow(m, 1))
    );
    b.variant("serveWait", "weight", (m) => breathe(m));
    actions.serve = {
      frames: [
        "stand",
        "serveHand",
        "serveHand",
        "serveTill",
        "serveTake",
        "stand",
        "serveWait",
        "weight",
        "stand",
        "breathe"
      ],
      frameMs: 460,
      loops: 1
    };
    actions.serveTalk = {
      frames: ["talkA", "stand", "serveHand", "talkB", "nod", "stand"],
      frameMs: 320,
      loops: 1,
      interruptible: true
    };
  }
  if (doing === "running") {
    b.frame(
      "runA",
      (f) => side("legsSideStride")(f).map(withSideArms(ARM.pumpUp, ARM.pumpDown)).map((m) => rise(m))
    );
    b.frame("runB", (f) => side("legsSidePass")(f).map(withSideArms(ARM.pumpMid, ARM.pumpMid)));
    b.frame(
      "runC",
      (f) => side("legsSideStride")(f).map(withSideArms(ARM.pumpDown, ARM.pumpUp)).map((m) => rise(m))
    );
    b.variant("runD", "runB", (m) => breathe(m));
    actions.run = { frames: ["runA", "runB", "runC", "runD"], frameMs: 120, loops: 8 };
  }
  if (doing === "lifting") {
    b.frame(
      "liftSet",
      (f) => front("legsApart")(f).map(withArms(ARM.workHigh, ARM.workHigh)).map((m) => breathe(m, 1))
    );
    b.frame(
      "liftDip",
      (f) => front("legsApart")(f).map(withArms(ARM.workHigh, ARM.workHigh)).map((m) => breathe(m, 3))
    );
    b.frame("liftDrive", (f) => front("legsApart")(f).map(withArms(ARM.hail, ARM.hail)));
    b.variant("liftLock", "liftDrive", (m) => raiseChin(m));
    b.frame("liftRest", (f) => front("legsApart")(f).map(withArms(ARM.hip, ARM.hip)));
    b.variant("liftBreathe", "liftRest", (m) => breathe(m));
    actions.lift = {
      frames: [
        "liftSet",
        "liftDip",
        "liftDrive",
        "liftLock",
        "liftDrive",
        "liftDip",
        "liftSet",
        "liftRest",
        "liftBreathe",
        "liftRest"
      ],
      frameMs: 340,
      loops: 1
    };
  }
  if (doing === "sitting") {
    b.frame(
      "sit",
      (f) => f.stack("head", "torso", "legsSit").map(withArms(ARM.rest, holding(ARM.rest)))
    );
    b.variant("sitBreathe", "sit", (m) => breathe(m));
    b.variant("sitNod", "sit", (m) => bow(m, 1));
    b.frame(
      "sitTalk",
      (f) => f.stack("head", "torso", "legsSit").map(withArms(ARM.rest, ARM.talk))
    );
    b.frame(
      "sitLean",
      (f) => f.stack("head", "torso", "legsSit").map(withArms(ARM.rest, ARM.rest)).map((m) => bow(m, 1))
    );
    b.frame(
      "crouchUp",
      (f) => front("legsApart")(f).map(withArms(ARM.rest, ARM.rest)).map((m) => breathe(m, 2))
    );
    b.frame(
      "sitLook",
      (f) => f.stack("head", "torso", "legsSit").map(withArms(ARM.rest, ARM.rest)).map(mirrorHead)
    );
    actions.sit = {
      frames: ["sit", "sit", "sitBreathe", "sit", "sitLook", "sit", "sitBreathe", "sitNod"],
      frameMs: 700,
      loops: 1
    };
    actions.standUp = {
      frames: ["sit", "sitLean", "crouchUp", "stand", "stand"],
      frameMs: 320,
      loops: 1
    };
    actions.sitDown = {
      frames: ["stand", "crouchUp", "sitLean", "sit", "sit"],
      frameMs: 320,
      loops: 1
    };
    actions.sitTalk = {
      frames: ["sitTalk", "sit", "sitTalk", "sitNod", "sit", "sitTalk"],
      frameMs: 340,
      loops: 1,
      interruptible: true
    };
  }
  if (doing === "leaning" || doing === "waiting") {
    b.frame("lean", (f) => front("legsApart")(f).map(withArms(ARM.foldOver, ARM.foldUnder)));
    b.variant("leanBreathe", "lean", (m) => breathe(m));
    b.variant("leanLook", "lean", (m) => mirrorHead(m));
    b.frame("checkWatch", (f) => front("legsApart")(f).map(withArms(ARM.rest, ARM.toFace)));
    actions.lean = {
      frames: [
        "lean",
        "leanBreathe",
        "lean",
        "leanLook",
        "lean",
        "checkWatch",
        "checkWatch",
        "lean",
        "leanBreathe",
        "lean",
        "checkPhone",
        "checkPhone",
        "checkPhone",
        "lean",
        "leanLook",
        "lean",
        "scratchHead",
        "lean",
        "leanBreathe",
        "lean"
      ],
      frameMs: 700,
      loops: 1
    };
  }
  if (doing === "smoking") {
    const cig = (h, drag) => {
      const dir = h.x >= CENTRE ? -1 : 1;
      const tip = { x: h.x + dir * 2, y: h.y };
      return [
        { x: h.x + dir, y: h.y, z: "c" },
        { x: tip.x, y: tip.y, z: "o" },
        // the drag: the ember doubles and throws light onto the row above it
        ...drag ? [{ x: tip.x, y: tip.y - 1, z: "o" }] : []
      ];
    };
    const wisp = (h, phase) => {
      const away = h.x >= CENTRE ? 1 : -1;
      const x = h.x + (h.x >= CENTRE ? -2 : 2);
      const drift = [0, 1, 1, 2];
      return [0, 1].map((i) => ({
        x: x + away * drift[(i + phase) % 4],
        y: h.y - 3 - i * 2,
        z: i === 0 ? "w" : "W"
      }));
    };
    const breath = (stage) => {
      const puff = (x, y, w, z) => Array.from({ length: w }, (_, i) => ({ x: x + i, y, z }));
      if (stage === 0) return puff(CENTRE, 5, 3, "w");
      if (stage === 1) return [...puff(CENTRE + 2, 5, 3, "w"), ...puff(CENTRE + 3, 4, 3, "W")];
      if (stage === 2) {
        return [
          ...puff(CENTRE + 4, 4, 4, "w"),
          ...puff(CENTRE + 4, 3, 4, "W"),
          ...puff(CENTRE + 6, 2, 3, "W")
        ];
      }
      return [...puff(CENTRE + 6, 2, 4, "W"), ...puff(CENTRE + 7, 1, 3, "W")];
    };
    const smokeFrame = (pose, opts = {}) => {
      const hand = handAt(a, 1, pose);
      return (m) => {
        let out = stamp(m, [...arm(a, -1, ARM.pocket, farArm), ...arm(a, 1, pose, armOpts)]);
        out = stamp(out, cig(hand, opts.drag ?? false));
        if (opts.phase !== void 0) out = stamp(out, wisp(hand, opts.phase));
        if (opts.exhale !== void 0) out = stamp(out, breath(opts.exhale));
        return out;
      };
    };
    b.frame("smokeRest", (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { phase: 0 })));
    b.frame(
      "smokeRestB",
      (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { phase: 2 })).map((m) => breathe(m))
    );
    b.frame("smokeLift", (f) => front("legsApart")(f).map(smokeFrame(ARM.toChin)));
    b.frame("smokeDrag", (f) => front("legsApart")(f).map(smokeFrame(ARM.toMouth, { drag: true })));
    b.frame("smokeDragB", (f) => front("legsApart")(f).map(smokeFrame(ARM.atLips, { drag: true })));
    b.frame("smokeHold", (f) => front("legsApart")(f).map(smokeFrame(ARM.toChin)));
    b.frame("smokeOut1", (f) => front("legsApart")(f).map(smokeFrame(ARM.toChin, { exhale: 0 })));
    b.frame("smokeOut2", (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { exhale: 1 })));
    b.frame("smokeOut3", (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { exhale: 2 })));
    b.frame(
      "smokeOut4",
      (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { phase: 2, exhale: 3 }))
    );
    b.frame(
      "smokeFlick",
      (f) => front("legsApart")(f).map((m) => {
        const hand = handAt(a, 1, ARM.rest);
        let out = smokeFrame(ARM.rest, { phase: 3 })(m);
        out = stamp(out, [
          { x: hand.x - 1, y: hand.y + 3, z: "W" },
          { x: hand.x - 2, y: hand.y + 6, z: "W" }
        ]);
        return out;
      })
    );
    actions.smoke = {
      frames: [
        "smokeRest",
        "smokeRestB",
        "smokeLift",
        "smokeDrag",
        "smokeDragB",
        "smokeDragB",
        "smokeHold",
        "smokeOut1",
        "smokeOut2",
        "smokeOut3",
        "smokeOut4",
        "smokeRest",
        "smokeRestB",
        "smokeFlick",
        "smokeRest",
        "smokeRestB",
        "smokeRest"
      ],
      frameMs: 420,
      loops: 1
    };
    actions.smokeTalk = {
      frames: ["smokeRest", "smokeRestB", "smokeLift", "smokeRest", "smokeRestB", "smokeRest"],
      frameMs: 360,
      loops: 1,
      interruptible: true
    };
  }
  if (doing === "phoning") {
    const handset = (h) => {
      const dir = h.x >= CENTRE ? -1 : 1;
      const cells = [];
      for (let dy = -3; dy <= 1; dy++) {
        cells.push({ x: h.x, y: h.y + dy, z: dy === -3 ? "c" : "n" });
        cells.push({ x: h.x + dir, y: h.y + dy, z: "n" });
      }
      return cells;
    };
    const call = (free) => (m) => {
      const hand = handAt(a, 1, ARM.toEar);
      const holding2 = arm(a, 1, ARM.toEar, armOpts);
      let out = stamp(m, arm(a, -1, free, farArm));
      out = stamp(out, holding2);
      out = stamp(out, handset(hand));
      out = stamp(out, holding2.slice(-4));
      return out;
    };
    b.frame("callUp", (f) => front("legs")(f).map(call(ARM.pocket)));
    b.variant("callBreathe", "callUp", (m) => breathe(m));
    b.frame("callTalkA", (f) => front("legs")(f).map(call(ARM.talk)));
    b.frame("callTalkB", (f) => front("legs")(f).map(call(ARM.talkWide)));
    b.frame("callShrug", (f) => front("legs")(f).map(call(ARM.shrug)));
    b.frame(
      "callPace",
      (f) => front("legsWeight")(f).map(call(ARM.pocket)).map((m) => sway(m, 1))
    );
    b.variant("callNod", "callUp", (m) => bow(m, 1));
    b.variant("callAway", "callUp", (m) => mirrorHead(m));
    b.frame("callDown", (f) => front("legs")(f).map(withArms(ARM.pocket, ARM.toChin)));
    b.frame(
      "callCheck",
      (f) => front("legs")(f).map(withArms(ARM.pocket, ARM.hold)).map((m) => bow(m, 1))
    );
    actions.call = {
      frames: [
        "callUp",
        "callBreathe",
        "callTalkA",
        "callUp",
        "callNod",
        "callUp",
        "callTalkB",
        "callTalkA",
        "callUp",
        "callPace",
        "callBreathe",
        "callAway",
        "callUp",
        "callShrug",
        "callUp",
        "callNod",
        "callBreathe",
        "callUp"
      ],
      frameMs: 460,
      loops: 1
    };
    actions.hangUp = {
      frames: ["callUp", "callNod", "callDown", "callCheck", "callCheck", "stand"],
      frameMs: 380,
      loops: 1
    };
    actions.callTalk = {
      frames: ["callUp", "callNod", "callTalkA", "callUp", "callBreathe"],
      frameMs: 360,
      loops: 1,
      interruptible: true
    };
  }
  if (doing === "washing") {
    const FLOOR = a.floorY;
    const mop = (headX, wet) => {
      const grip = handAt(a, 1, ARM.workLow);
      const cells = [
        ...stroke(grip.x, grip.y - 4, headX + 1, FLOOR - 3, "n", 1),
        // the head: a flat pad, wider than the handle, sitting on the floor
        ...[-2, -1, 0, 1, 2].map((dx) => ({ x: headX + dx, y: FLOOR - 2, z: "c" })),
        ...[-3, -2, -1, 0, 1, 2, 3].map((dx) => ({ x: headX + dx, y: FLOOR - 1, z: "c" })),
        ...[-3, -2, -1, 0, 1, 2, 3].map((dx) => ({ x: headX + dx, y: FLOOR, z: "n" }))
      ];
      for (const x of wet) cells.push({ x, y: FLOOR, z: "v" });
      return cells;
    };
    const wash = (headX, wet, lean) => (m) => {
      let out = stamp(m, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }));
      out = stamp(out, mop(headX, wet));
      out = stamp(out, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }).slice(-6));
      out = stamp(out, arm(a, 1, ARM.gripLow, armOpts));
      return lean === 0 ? out : sway(out, lean);
    };
    b.frame("washOut", (f) => front("legsApart")(f).map(wash(20, [8, 10, 13], 1)));
    b.frame("washMidA", (f) => front("legsApart")(f).map(wash(16, [8, 10, 19, 21], 0)));
    b.frame("washIn", (f) => front("legsApart")(f).map(wash(6, [12, 15, 18, 20], -1)));
    b.frame("washMidB", (f) => front("legsApart")(f).map(wash(11, [5, 7, 18, 21], 0)));
    b.frame(
      "washWring",
      (f) => front("legsApart")(f).map((m) => {
        let out = stamp(m, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }));
        out = stamp(out, mop(13, []));
        out = stamp(out, arm(a, 1, ARM.gripLow, armOpts));
        out = stamp(out, [
          { x: 12, y: FLOOR - 5, z: "v" },
          { x: 15, y: FLOOR - 4, z: "v" }
        ]);
        return out;
      }).map((m) => bow(m, 1))
    );
    b.variant("washWringB", "washWring", (m) => breathe(m));
    b.frame(
      "washStand",
      (f) => front("legsApart")(f).map((m) => {
        let out = stamp(m, arm(a, -1, ARM.back, farArm));
        out = stamp(out, mop(17, [8, 11, 14]));
        return stamp(out, arm(a, 1, ARM.gripHigh, armOpts));
      })
    );
    b.variant("washStandB", "washStand", (m) => raiseChin(m));
    b.frame(
      "washBrow",
      (f) => front("legsApart")(f).map((m) => {
        let out = stamp(m, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }));
        out = stamp(out, mop(6, [10, 13, 16]));
        return stamp(out, arm(a, 1, ARM.toFace, armOpts));
      })
    );
    const stroke1 = ["washMidA", "washOut", "washMidA", "washIn", "washMidB"];
    actions.wash = {
      frames: [
        ...stroke1,
        ...stroke1,
        "washStand",
        "washStandB",
        "washWring",
        "washWringB",
        "washWring",
        "washStand",
        ...stroke1,
        "washBrow",
        "washStandB"
      ],
      frameMs: 380,
      loops: 1
    };
    actions.work = actions.wash;
    actions.wring = {
      frames: ["washStand", "washWring", "washWringB", "washWring", "washWringB", "washStand"],
      frameMs: 400,
      loops: 1
    };
    actions.rest = {
      frames: ["washStand", "washStandB", "washStand", "washBrow", "washStand", "washStandB"],
      frameMs: 620,
      loops: 1
    };
    actions.talkAtWork = {
      frames: ["washStand", "washStandB", "talkA", "washStand", "talkC", "washStandB"],
      frameMs: 340,
      loops: 1,
      interruptible: true
    };
  }
  for (const [id, def] of Object.entries(actions)) b.action(id, def);
  const built = b.build();
  const trim = TRIM[height];
  const frames = trim ? Object.fromEntries(
    Object.entries(built.frames).map(([name, map]) => [name, shorten(map, trim)])
  ) : built.frames;
  const idleAction = spec.reactions?.idle ?? (doing === "working" ? "work" : doing === "serving" ? "serve" : doing === "running" ? "run" : doing === "lifting" ? "lift" : doing === "washing" ? "wash" : doing === "phoning" ? "call" : doing === "sitting" ? "sit" : doing === "leaning" || doing === "waiting" ? "lean" : doing === "smoking" ? "smoke" : "idle");
  return {
    ...built,
    frames,
    id: spec.id,
    name: spec.name,
    idleAction,
    reactions: {
      onTalk: spec.reactions?.onTalk ?? (doing === "sitting" ? "sitTalk" : doing === "working" || doing === "washing" ? "talkAtWork" : doing === "serving" ? "serveTalk" : doing === "smoking" ? "smokeTalk" : doing === "phoning" ? "callTalk" : "talk"),
      onNotice: spec.reactions?.onNotice ?? "notice",
      idle: idleAction
    },
    lines: spec.lines ?? [],
    look
  };
}

// src/engine/ui/AudioHud.tsx
var import_react4 = __toESM(require_react(), 1);

// src/engine/ui/FpsMeter.tsx
var import_react5 = __toESM(require_react(), 1);

// src/engine/ui/NpcActor.tsx
var import_react6 = __toESM(require_react(), 1);

// src/game/apartment/npcs.ts
var NPCS = {
  /** The stairwell, every morning. From Poltava, and homesick with it. */
  natalia: createNpc({
    id: "pani-natalia",
    name: "Pani Natalia",
    build: "slim",
    height: "short",
    doing: "washing",
    look: {
      skin: "fair",
      hair: "grey",
      hairStyle: "bun",
      hat: "kerchief",
      hatColour: "sky",
      top: "jumper",
      topColour: "teal",
      bottom: "trousers",
      bottomColour: "navy",
      shoes: "boots",
      shoeColour: "black",
      accent: "apron",
      accentColour: "cream",
      prop: "mop"
    },
    lines: [
      "\u0417\u043D\u043E\u0432\u0443 \u0445\u0442\u043E\u0441\u044C \u043D\u0430\u0441\u043B\u0456\u0434\u0438\u0432 \u043F\u043E \u0441\u0432\u0456\u0436\u043E\u043C\u0443...",
      "\u0412\u0434\u043E\u043C\u0430 \u0437\u0430\u0440\u0430\u0437 \u0430\u0431\u0440\u0438\u043A\u043E\u0441\u0438. \u0410 \u0442\u0443\u0442 \u2014 \u0441\u0445\u043E\u0434\u0438.",
      "\u0414\u043E\u043D\u0435\u0447\u043A\u0430 \u0434\u0437\u0432\u043E\u043D\u0438\u043B\u0430. \u041A\u0430\u0436\u0435, \u0432\u0441\u0435 \u0434\u043E\u0431\u0440\u0435. \u041A\u0430\u0436\u0435.",
      "\u0429\u0435 \u0434\u0432\u0430 \u043F\u043E\u0432\u0435\u0440\u0445\u0438, \u0456 \u0447\u0430\u0439."
    ]
  }),
  /** By the Octavia, one cigarette into a bad week. */
  marek: createNpc({
    id: "pan-marek",
    name: "Pan Marek",
    build: "stout",
    height: "short",
    doing: "smoking",
    look: {
      skin: "tan",
      hair: "grey",
      hairStyle: "receding",
      face: "moustache",
      top: "jacket",
      topColour: "charcoal",
      bottom: "jeans",
      bottomColour: "denim",
      shoes: "boots",
      shoeColour: "brown",
      accent: "vest",
      accentColour: "hiVis",
      prop: "cigarette"
    },
    lines: [
      "Kurwa, znowu kto\u015B zaj\u0105\u0142 moje miejsce.",
      "Osiemna\u015Bcie lat na tym parkingu. Osiemna\u015Bcie.",
      "Zim\u0105 to auto wstaje gorzej ni\u017C ja."
    ]
  }),
  /** The one outside the klatka, permanently quitting on Monday. */
  smoker: createNpc({
    id: "smoker",
    name: "S\u0105siad",
    build: "regular",
    height: "average",
    doing: "smoking",
    look: {
      skin: "fair",
      hair: "black",
      hairStyle: "crop",
      face: "stubble",
      top: "hoodie",
      topColour: "charcoal",
      bottom: "jeans",
      bottomColour: "charcoal",
      shoes: "trainers",
      shoeColour: "black",
      prop: "cigarette"
    },
    lines: ["Rzucam od poniedzia\u0142ku.", "...Nie pytaj od kt\xF3rego.", "\u0141adny wiecz\xF3r, nie?"]
  }),
  /** The bench by block 14 is hers, and the pigeons know it. */
  babcia: createNpc({
    id: "babcia",
    name: "Babcia Krysia",
    build: "stout",
    height: "short",
    doing: "sitting",
    look: {
      skin: "pale",
      hair: "white",
      hairStyle: "bun",
      face: "old",
      hat: "kerchief",
      hatColour: "maroon",
      top: "coat",
      topColour: "plum",
      bottom: "skirt",
      bottomColour: "charcoal",
      shoes: "shoes",
      shoeColour: "black",
      accent: "shawl",
      accentColour: "grey",
      prop: "bag"
    },
    lines: [
      "Za moich czas\xF3w tu by\u0142o pole.",
      "Ty jeste\u015B ten z czternastki? Wysoki wyros\u0142e\u015B.",
      "Nie karm ich chlebem. Kasz\u0105."
    ]
  }),
  /** Outside the shop, on the phone to somebody who is not listening either. */
  caller: createNpc({
    id: "caller",
    name: "S\u0105siad z telefonem",
    build: "regular",
    height: "average",
    doing: "phoning",
    look: {
      skin: "olive",
      hair: "black",
      hairStyle: "receding",
      head: "square",
      brow: "heavy",
      nose: "hook",
      mouth: "set",
      face: "stubble",
      top: "jacket",
      topColour: "brick",
      bottom: "jeans",
      bottomColour: "denim",
      shoes: "shoes",
      shoeColour: "brown",
      propColour: "charcoal"
    },
    lines: [
      "...no i m\xF3wi\u0119 jej: nie moja sprawa.",
      "Halo? Halo. Nic nie s\u0142ycha\u0107.",
      "Dobra, oddzwoni\u0119. Oddzwoni\u0119!"
    ]
  }),
  /** Żabka, night shift, philosophical about it. */
  zbyszek: createNpc({
    id: "zbyszek",
    name: "Pan Zbyszek",
    build: "regular",
    height: "short",
    doing: "waiting",
    look: {
      skin: "fair",
      hair: "grey",
      hairStyle: "receding",
      top: "shirt",
      topColour: "green",
      bottom: "trousers",
      bottomColour: "charcoal",
      shoes: "shoes",
      shoeColour: "black",
      accent: "lanyard",
      accentColour: "green"
    },
    lines: ["Kawa czy energetyk? Bo to r\xF3\u017Cne filozofie.", "O tej porze to ju\u017C tylko my dwaj."]
  }),
  /** The cellar gym, four decades of squats, one opinion about your hips. */
  trener: createNpc({
    id: "trener",
    name: "Trener",
    build: "stout",
    height: "short",
    doing: "standing",
    look: {
      skin: "tan",
      hair: "grey",
      hairStyle: "crop",
      face: "moustache",
      hat: "cap",
      hatColour: "navy",
      top: "tracksuit",
      topColour: "teal",
      bottom: "tracksuit",
      bottomColour: "charcoal",
      shoes: "trainers",
      shoeColour: "white",
      accent: "lanyard",
      accentColour: "mustard",
      prop: "clipboard"
    },
    lines: [
      "Plecy proste. Zawsze proste.",
      "Ta gira jest starsza od ciebie i nigdy nie narzeka\u0142a.",
      "Odpoczynek to cz\u0119\u015B\u0107 serii. Nie wstyd."
    ]
  }),
  /** The square, with a bag of kasza and a full census of the pigeons. */
  golebiarka: createNpc({
    id: "golebiarka",
    name: "Pani Go\u0142\u0119biarka",
    build: "slim",
    height: "short",
    doing: "standing",
    look: {
      skin: "pale",
      hair: "white",
      hairStyle: "bun",
      face: "old",
      hat: "kerchief",
      hatColour: "plum",
      top: "coat",
      topColour: "olive",
      bottom: "skirt",
      bottomColour: "brown",
      shoes: "boots",
      shoeColour: "black",
      accent: "scarf",
      accentColour: "maroon",
      prop: "shopping"
    },
    lines: ["Ten siwy to Zbyszek. Po prezesie.", "Go\u0142\u0105b wszystko widzi. Dlatego tak patrzy."]
  }),
  /** InPost, a hundred and twenty parcels, four hours left. */
  courier: createNpc({
    id: "courier",
    name: "Kurier",
    build: "regular",
    height: "short",
    doing: "walking",
    look: {
      skin: "olive",
      hair: "black",
      hairStyle: "crop",
      hat: "cap",
      hatColour: "mustard",
      top: "jacket",
      topColour: "mustard",
      bottom: "workpants",
      bottomColour: "charcoal",
      shoes: "trainers",
      shoeColour: "black",
      accent: "backpack",
      accentColour: "charcoal",
      prop: "shopping"
    },
    lines: ["Kovtun? Nie? To nie podpisujesz.", "Apka m\xF3wi, \u017Ce dam rad\u0119."]
  }),
  /** Żabka at 2am, sesja, energy drinks, unshakeable optimism. */
  student: createNpc({
    id: "student",
    name: "Student",
    build: "slim",
    height: "average",
    doing: "standing",
    look: {
      skin: "fair",
      hair: "chestnut",
      hairStyle: "curly",
      top: "hoodie",
      topColour: "maroon",
      bottom: "jeans",
      bottomColour: "denim",
      shoes: "trainers",
      shoeColour: "white",
      accent: "backpack",
      accentColour: "forest",
      prop: "phone"
    },
    lines: ["Kolokwium o \xF3smej.", "Spanie jest dla ludzi po sesji."]
  }),
  /** Waiting outside the shop for someone who said two minutes. */
  waiting: createNpc({
    id: "waiting-man",
    name: "Czekaj\u0105cy",
    build: "regular",
    height: "short",
    doing: "waiting",
    look: {
      skin: "tan",
      hair: "brown",
      hairStyle: "short",
      face: "stubble",
      top: "shirt",
      topColour: "navy",
      bottom: "trousers",
      bottomColour: "grey",
      shoes: "shoes",
      shoeColour: "brown",
      accent: "tie",
      accentColour: "maroon"
    },
    lines: ["Czekam na \u017Con\u0119. Dwie minuty, powiedzia\u0142a.", "Czterdzie\u015Bci minut temu."]
  }),
  /** Behind the Żabka counter at whatever hour you turn up. */
  clerk: createNpc({
    id: "zabka-clerk",
    name: "Pani z \u017Babki",
    build: "regular",
    height: "short",
    doing: "serving",
    look: {
      skin: "fair",
      hair: "chestnut",
      hairStyle: "ponytail",
      top: "shirt",
      topColour: "green",
      bottom: "trousers",
      bottomColour: "charcoal",
      shoes: "trainers",
      shoeColour: "white",
      accent: "lanyard",
      accentColour: "white"
    },
    lines: ["Dzie\u0144 dobry. Reklam\xF3wka?", "Kawa dzi\u015B dobrze idzie.", "Paragon w \u015Brodku."]
  }),
  /** Somebody in front of you in the queue, deciding. */
  shopper: createNpc({
    id: "zabka-customer",
    name: "Klient",
    build: "slim",
    height: "short",
    doing: "waiting",
    look: {
      skin: "olive",
      hair: "black",
      hairStyle: "undercut",
      top: "hoodie",
      topColour: "navy",
      texture: "worn",
      bottom: "jeans",
      bottomColour: "denim",
      shoes: "trainers",
      shoeColour: "grey",
      prop: "shopping"
    },
    lines: ["...a jednak wezm\u0119 t\u0119 drug\u0105.", "Zaraz, gdzie ja mam kart\u0119."]
  }),
  /** Reception at the gym: a fob, a smile, and the playlist is hers. */
  kasia: createNpc({
    id: "gym-kasia",
    name: "Kasia",
    build: "slim",
    height: "short",
    doing: "serving",
    look: {
      skin: "fair",
      hair: "blond",
      hairStyle: "ponytail",
      top: "tshirt",
      topColour: "black",
      bottom: "tracksuit",
      bottomColour: "black",
      shoes: "trainers",
      shoeColour: "white",
      accent: "lanyard",
      accentColour: "red"
    },
    lines: ["Karnet poprosz\u0119.", "Szatnia po prawej.", "Playlista moja, uprzedzam."]
  }),
  /** Treadmill two, twenty minutes in, watching the street go past. */
  runner: createNpc({
    id: "gym-runner",
    name: "Biegacz",
    build: "slim",
    height: "average",
    doing: "running",
    look: {
      skin: "tan",
      hair: "black",
      hairStyle: "crop",
      top: "tank",
      topColour: "sky",
      bottom: "shorts",
      bottomColour: "charcoal",
      shoes: "trainers",
      shoeColour: "red"
    },
    lines: ["...", "Jeszcze dwa kilometry."]
  }),
  /** Under the rack, between sets, considering the universe. */
  lifter: createNpc({
    id: "gym-lifter",
    name: "Pakerz",
    build: "stout",
    height: "short",
    doing: "lifting",
    look: {
      skin: "tan",
      hair: "brown",
      hairStyle: "shaved",
      face: "beard",
      top: "tank",
      topColour: "maroon",
      bottom: "shorts",
      bottomColour: "black",
      shoes: "trainers",
      shoeColour: "black",
      accent: "belt",
      accentColour: "brown"
    },
    lines: ["Jeszcze jedna.", "Oddychaj, to po\u0142owa roboty."]
  }),
  /** Café Orbita, behind the machine, one eye on the queue. */
  barista: createNpc({
    id: "cafe-barista",
    name: "Barista",
    build: "slim",
    height: "short",
    doing: "serving",
    look: {
      skin: "olive",
      hair: "black",
      hairStyle: "topknot",
      face: "stubble",
      top: "shirt",
      topColour: "denim",
      texture: "check",
      bottom: "jeans",
      bottomColour: "charcoal",
      shoes: "trainers",
      shoeColour: "white",
      accent: "apron",
      accentColour: "charcoal"
    },
    lines: ["Flat white? Zaraz b\u0119dzie.", "Ziarno dzi\u015B etiopskie.", "Na miejscu czy na wynos?"]
  }),
  /** Somebody crossing the square who has somewhere to be. */
  walker: createNpc({
    id: "district-walker",
    name: "Przechodzie\u0144",
    build: "regular",
    height: "short",
    doing: "walking",
    look: {
      skin: "pale",
      hair: "brown",
      hairStyle: "curtains",
      top: "coat",
      topColour: "olive",
      bottom: "trousers",
      bottomColour: "charcoal",
      shoes: "shoes",
      shoeColour: "brown",
      accent: "scarf",
      accentColour: "maroon",
      prop: "umbrella"
    },
    lines: ["Przepraszam.", "Zimno dzi\u015B, nie?"]
  })
};
var NPC_LIST = Object.values(NPCS);
var NPC_BY_OBJECT = Object.fromEntries(
  NPC_LIST.map((npc) => [npc.id, npc])
);

// ../../../../tmp/claude-1000/-home-ivan-development-ivasik-k7-github-io/f21320c1-0d84-4730-a980-08806e2699a4/scratchpad/probe/heads.ts
var names = Object.keys(NPCS);
var COLS = 6;
for (let i = 0; i < names.length; i += COLS) {
  const group = names.slice(i, i + COLS);
  console.log(group.map((n) => n.padEnd(11)).join(" "));
  const maps = group.map((n) => {
    const c = NPCS[n];
    return (c.frames.stand ?? c.frames[Object.keys(c.frames)[0]]).slice(0, 9);
  });
  for (let r = 0; r < 9; r++) {
    console.log(maps.map((m) => (m[r] ?? "").slice(5, 19).replace(/\./g, " ").padEnd(11)).join("|"));
  }
  console.log("");
}
/*! Bundled license information:

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
