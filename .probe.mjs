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

// src/components/game/sprites.tsx
var PLAYER_PALETTE = {
  h: "#3a2a1e",
  // hair
  H: "#2b1e15",
  // hair shade / hair dark
  s: "#e0b48c",
  // skin
  S: "#c79a72",
  // skin shade — jaw, neck shadow, inner arm
  y: "#ead9a8",
  // skin highlight — pecs, bicep swell, forearm catch
  e: "#2f6b3f",
  // green eyes — muted
  t: "#1d1d24",
  // black sport t-shirt
  T: "#0a0a0e",
  // shirt deep shade — pec shadow, under-arm
  u: "#7a8f9f",
  // duvet — matches the bedroom's slate ramp
  U: "#687c8b",
  // duvet fold shade
  p: "#33415e",
  // trousers
  q: "#28344c",
  // trousers shade (back leg)
  Q: "#1e2839",
  // trousers deep shade (inner back leg mid-stride)
  k: "#2e4568",
  // cap crown (wardrobe-deletable zone)
  K: "#23344d",
  // cap brim/shade
  m: "#6d7278",
  // hood & pocket (wardrobe-deletable zone)
  M: "#565a60",
  // hood shade
  f: "#7a5c48",
  // stubble
  F: "#5f4636",
  // stubble shade
  b: "#d8d8d0",
  // sneakers
  B: "#8f9089",
  // soles
  g: "#43434b",
  // giria (kettlebell)
  G: "#5c5c66",
  // giria highlight
  R: "#9aa0a8",
  // barbell bar
  P: "#3f3f47",
  // barbell plates
  c: "#f0ede4",
  // cigarette / mug
  o: "#e07a30",
  // ember
  x: "#c96a28",
  // ember halo — the light the coal throws on skin and air
  v: "#b8b4ac",
  // cigarette smoke
  w: "#c9863f",
  // guitar top — the same honeyed spruce as the one on the wall
  W: "#8a5a28",
  // guitar rim / side shade
  n: "#3a2614"
  // guitar neck, fretboard, soundhole
};
var BODY = [
  "............hhhhhh............",
  "...........HhhhhhH............",
  "...........hhhhhhhh...........",
  "...........hSsshsSh...........",
  "...........hsssessh...........",
  "...........hssssff............",
  ".........sshsssshhss..........",
  "......ttTssTtTTtTssTt.........",
  "......ttTssyttytssTt..........",
  "....ttttTTssTTyTTssTTtttt.....",
  "....ttttTyssTyTTssTTtttt......",
  "....SSTtsstsssssTTSs..........",
  "....SSssstsssssTTSs...........",
  "...SSSssstsssssSSSs...........",
  "...SSSssstsssssSSSs...........",
  "...SSssstsssssSSSs............",
  "...SSssstsssstSSSs............",
  "....sssTttttttTss.............",
  ".....sssttttttss..............",
  ".....TttttttttttttT...........",
  ".....pppppppppppppp...........",
  ".....ppqpppppppppq............",
  ".....ppqpppppppppq............",
  ".....qpppppppppppq............",
  ".....qpppppppppppq............"
];
var LEGS_STAND = [
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......qqqqqq..qqqqqq.......",
  ".......BBBBBB..BBBBBB......."
];
var LEGS_STRIDE = [
  "......pppppp....pppppp......",
  "......pppppp....pppppp......",
  "......pppppp....pppppp......",
  "......pppppp....pppppp......",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....qqqqqq........qqqqqq...",
  "....BBBBBB........BBBBBB...."
];
var LEGS_PASS = [
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........QQQQQQQQQQQQ........",
  ".......BBBBBBBBBBBB........."
];
var LEGS_BENT = [
  "......pppppp..pppppp.......",
  "......pppppp..pppppp.......",
  "......pppppp..pppppp.......",
  ".....pppppp....pppppp......",
  ".....pppppp....pppppp......",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....qqqq........qqqq......",
  "...BBBB........BBBB......."
];
function compose(legs, patches = []) {
  const grid = [...BODY, ...legs].map((row2) => row2.split(""));
  for (const patch of patches) {
    patch.rows.forEach((row2, dy) => {
      for (let dx = 0; dx < row2.length; dx++) {
        const ch = row2[dx];
        if (ch === ".") continue;
        const y = patch.r + dy;
        const x = patch.c + dx;
        if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = ch;
      }
    });
  }
  return grid.map((row2) => row2.join(""));
}
var GIRIA = [".GG.", "g..g", "gggg", "gGgg", "gggg", ".gg."];
var BARBELL = ["PP................PP", "PPRRRRRRRRRRRRRRRRPP", "PP................PP"];
var ARM_DOWN = ["ss", "ss", "ss", "ss", "ss", "ss", "ss", "ss", "ss", "ss"];
var LEAN_A = [
  "........................",
  "........................",
  "...........hhhhhh........",
  "..........HhhhhhH........",
  "..........hhhhhhhh........",
  "..........hSssssSh........",
  "..........hsssessh........",
  "..........hssssss.........",
  "...........ssssh.........",
  ".....ttssTttttTssTTt.....",
  "....ttssTttyttssTTtt.....",
  "....ttTTssTTyTTssTTt.....",
  "....ttTyssTyTTssTTs......",
  "....SSTyssTysyssTss......",
  "....SSyssTysyssSSSs......",
  "....SSyssTysyssSSSs......",
  "....SSyssTysyssSSSc......",
  "....SsysstysystSSso......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......qqqqqq..qqqqqq......",
  ".......BBBBBB..BBBBBB......"
];
var LEAN_B = [
  "........................",
  "........................",
  "...........hhhhhh........",
  "..........HhhhhhH........",
  "..........hhhhhhhh........",
  "..........hSssssSh........",
  "..........hsssessh........",
  "..........hsssscs.........",
  "...........ssshos.........",
  ".....ttssTttttTssyTTt.....",
  "....ttssTttyttssTtytt.....",
  "....ttTTssTTyTTssTTt.....",
  "....ttTyssTyTTssTTs.......",
  "....ttTyssTysyssTTt.......",
  "....SSTyssTysyssSSSs......",
  "....SSyssTysyssSSSs......",
  "....SSyssTysyssSSSs......",
  "....SsysstysystSSss......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......qqqqqq..qqqqqq......",
  ".......BBBBBB..BBBBBB......"
];
var stripSmoke = (map) => map.map((row2) => row2.replace("c", ".").replace("o", "."));
var LEAN_PHONE_A = [
  "....................",
  "....................",
  "..........hhhh......",
  ".........hhhhhh.....",
  ".........hhhhhh.....",
  ".........hsssss.gg..",
  ".........hssses.gg..",
  ".........hsssss.gs..",
  "..........ssss..s...",
  "....tttttttttttts...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttt.ss....",
  "...tttttttttt..ss...",
  "...tttttttttt...ss..",
  "...tttttttttt....ss.",
  "...tttttttttt....ss.",
  "...tttttttttt.......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....bbbb..bbbb......",
  "...BBBBB..BBBBB....."
];
var LEAN_PHONE_B = [
  "....................",
  "....................",
  "....................",
  "..........hhhh......",
  ".........hhhhhh.....",
  ".........hhhhhh.....",
  ".........hsssss.gg..",
  ".........hssses.gg..",
  ".........hsssss.gs..",
  "....tttttttttttts...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttt.ss....",
  "...tttttttttt..ss...",
  "...tttttttttt...ss..",
  "...tttttttttt....ss.",
  "...tttttttttt....ss.",
  "...tttttttttt.......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....bbbb..bbbb......",
  "...BBBBB..BBBBB....."
];
var EMPTY_ROW = "....................";
var BODY_BREATHE = [EMPTY_ROW, ...BODY.slice(0, 6), ...BODY.slice(7)];
var withoutEye = (map) => map.map((row2) => row2.replace(/e/g, "s"));
var shiftedDown = (map) => [EMPTY_ROW, ...map.slice(0, map.length - 1)];
var STAND = compose(LEGS_STAND);
var STRIDE = compose(LEGS_STRIDE);
var LOOK_BACK = STAND.map((row2, i) => i <= 6 ? [...row2].reverse().join("") : row2);
var STRETCH_BODY = [
  "....ss........ss....",
  "....ss........ss....",
  "....ss..hhhh..ss....",
  "....ss.hhhhhh.ss....",
  "....ss.hhhhhh.ss....",
  "....ss.hsssss.ss....",
  "....ss.hssses.ss....",
  "....ss.hsssss.ss....",
  "....tt..ssss..tt....",
  "....tttttttttttt....",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "....tttttttttttt....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
  ".....pppppppppp....."
];
var LEGS_TIPTOE = [
  ...LEGS_STAND.slice(0, 11),
  ".......bbbbb...bbbbb.......",
  ".......BBBBB...BBBBB......."
];
var SQUAT = [
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  "........hhhh........",
  ".......hhhhhh.......",
  ".......hhhhhh.......",
  ".......hsssss.......",
  ".......hssses.......",
  ".......hsssss.......",
  "........ssss........",
  "...tttttttttttttt...",
  "...ttttttttttttttss.",
  "...ttttttttttttttss.",
  "...tttttttttttttt...",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
  "....pppppppppppp....",
  "....pppppppppppppp..",
  "...ppppppppppppppp..",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...bbb.......bbbb...",
  "..BBBB.......BBBBB.."
];
var SIT = [
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  "........hhhh........",
  ".......hhhhhh.......",
  ".......hhhhhh.......",
  ".......hsssss.......",
  ".......hssses.......",
  ".......hsssss.......",
  "........ssss........",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...ssttttttttttss...",
  "...ssttttttttttss...",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....ttttttttttss...",
  ".....pppppppppp.....",
  "....pppppppppppp....",
  "....pppppppppppppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............bbbb..",
  ".............BBBBB.."
];
var PLAYER_FRAMES = {
  stand: STAND,
  idleB: [...BODY_BREATHE, ...LEGS_STAND],
  blink: withoutEye(STAND),
  lookBack: LOOK_BACK,
  stretchA: [...STRETCH_BODY, ...LEGS_STAND],
  stretchB: [...STRETCH_BODY, ...LEGS_TIPTOE],
  squat: SQUAT,
  stride: STRIDE,
  strideLow: shiftedDown(STRIDE),
  pass: compose(LEGS_PASS),
  // one arm out toward whatever is being used — sleeve, then bare forearm
  reach: compose(LEGS_STAND, [{ r: 10, c: 16, rows: ["tsss", ".sss"] }]),
  sit: SIT,
  // reaching down toward the dog (its back is around rows 25–26)…
  crouch: compose(LEGS_BENT, [{ r: 16, c: 15, rows: ARM_DOWN }]),
  // …and the scratching motion, hand a pixel lower
  crouchB: compose(LEGS_BENT, [{ r: 17, c: 15, rows: ARM_DOWN }]),
  // kettlebell swing: giria hanging low in front, bare arms down the front line
  swingDown: compose(LEGS_STRIDE, [
    { r: 16, c: 15, rows: ["ss", "ss", "ss", "ss", "ss", "ss"] },
    { r: 22, c: 13, rows: GIRIA }
  ]),
  // top of the swing: giria driven to chest height, arms straight out
  swingUp: compose(LEGS_STAND, [
    { r: 11, c: 15, rows: ["ssss", "ssss"] },
    { r: 10, c: 16, rows: GIRIA }
  ]),
  // barbell at the chest…
  pressRack: compose(LEGS_STAND, [
    { r: 8, c: 0, rows: BARBELL },
    { r: 10, c: 3, rows: ["ss............ss"] }
  ]),
  // …the dip…
  pressDip: compose(LEGS_BENT, [
    { r: 8, c: 0, rows: BARBELL },
    { r: 10, c: 3, rows: ["ss............ss"] }
  ]),
  // …and overhead, split-jerk legs, bare arms locked out
  pressUp: compose(LEGS_STRIDE, [
    { r: 0, c: 0, rows: BARBELL },
    {
      r: 2,
      c: 4,
      rows: ["s..........s", "s..........s", "s..........s", "t..........t", "t..........t"]
    }
  ]),
  // sambo drill: grip-fighting arms forward…
  samboA: compose(LEGS_STRIDE, [{ r: 10, c: 16, rows: ["tsss", "ssss"] }]),
  // …a lower entry…
  samboB: compose(LEGS_BENT, [{ r: 13, c: 16, rows: ["sss.", "ssss"] }]),
  // …and the finish, pulling down through the throw
  samboC: compose(LEGS_BENT, [{ r: 12, c: 15, rows: ["ssss", "ss.."] }]),
  // tea: mug at the chest…
  drinkA: compose(LEGS_STAND, [{ r: 11, c: 14, rows: ["scc", ".cc"] }]),
  // …mug at the mouth, forearm raised in front of the chest
  drinkB: compose(LEGS_STAND, [
    { r: 5, c: 13, rows: ["scc", ".cc"] },
    { r: 7, c: 14, rows: ["ss", "ss", "ss", "ss"] }
  ]),
  leanA: LEAN_A,
  leanB: LEAN_B,
  leanIdle: stripSmoke(LEAN_A),
  phoneA: LEAN_PHONE_A,
  phoneB: LEAN_PHONE_B,
  // sign of the cross before the painting: forehead…
  prayA: compose(LEGS_STAND, [
    { r: 3, c: 13, rows: ["ss"] },
    { r: 4, c: 14, rows: ["s", "s", "s", "s"] }
  ]),
  // …chest…
  prayB: compose(LEGS_STAND, [{ r: 9, c: 12, rows: ["ss"] }]),
  // …shoulder…
  prayC: compose(LEGS_STAND, [{ r: 7, c: 13, rows: ["ss"] }]),
  // …then hands folded, a few words under his breath
  prayD: compose(LEGS_STAND, [{ r: 10, c: 11, rows: ["ssss"] }])
};
var WALK_CYCLE = ["strideLow", "stand", "pass", "stand"];
var ACTIONS = {
  use: { frames: ["reach"], frameMs: 350, loops: 1 },
  // pick the giria up out of the squat, then swing
  swing: {
    frames: ["squat", "swingDown", "swingUp", "swingDown", "swingUp"],
    frameMs: 420,
    loops: 2
  },
  // deadlift the bar, then clean → dip → jerk
  press: {
    frames: ["squat", "pressRack", "pressDip", "pressUp", "pressRack"],
    frameMs: 460,
    loops: 2
  },
  // loosen up, then grips, entry, throw
  sambo: {
    frames: ["stretchA", "samboA", "samboB", "samboA", "samboC"],
    frameMs: 400,
    loops: 2
  },
  pet: { frames: ["crouch", "crouchB"], frameMs: 420, loops: 3 },
  smoke: { frames: ["leanA", "leanB"], frameMs: 950, loops: 4, interruptible: true },
  call: { frames: ["phoneA", "phoneB"], frameMs: 900, loops: 5, interruptible: true },
  pray: {
    frames: ["prayA", "prayB", "prayC", "prayC", "prayD", "prayD", "prayD"],
    frameMs: 520,
    loops: 1,
    interruptible: true
  },
  sit: { frames: ["sit"], frameMs: 5e3, loops: 1, interruptible: true },
  drink: { frames: ["drinkA", "drinkB", "drinkB", "drinkA"], frameMs: 550, loops: 1 },
  reach: { frames: ["reach"], frameMs: 350, loops: 1 },
  talk: { frames: ["phoneA", "phoneB"], frameMs: 400, loops: 1 }
};

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
      const base2 = 2800 + Math.random() * 1200;
      osc.frequency.setValueAtTime(base2, at);
      osc.frequency.exponentialRampToValueAtTime(base2 * 1.4, at + 0.04);
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
function mirrorRows(map, from, to) {
  return map.map((row2, i) => i >= from && i <= to ? [...row2].reverse().join("") : row2);
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
    const base2 = this.frames.get(from);
    if (!base2) throw new Error(`character: variant "${name}" from unknown frame "${from}"`);
    if (this.frames.has(name)) throw new Error(`character: frame "${name}" already defined`);
    this.frames.set(name, transform(base2));
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

// src/engine/sprite/animalBuilder.ts
var ROWS = 26;
var FLOOR = ROWS - 1;

// src/engine/sprite/npcBody.ts
var HEAD_ROWS = 7;
var TORSO_ROWS = 15;
var LEG_ROWS = 16;
var ROWS2 = HEAD_ROWS + TORSO_ROWS + LEG_ROWS;
var CENTRE = 12;
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

// src/engine/sprite/npcBuilder.ts
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

// src/engine/ui/AnimalActor.tsx
var import_react4 = __toESM(require_react(), 1);

// src/engine/ui/AudioHud.tsx
var import_react5 = __toESM(require_react(), 1);

// src/engine/ui/FpsMeter.tsx
var import_react6 = __toESM(require_react(), 1);

// src/engine/ui/NpcActor.tsx
var import_react7 = __toESM(require_react(), 1);

// src/game/apartment/player.ts
var HEAD = [
  "........................",
  "..........kkkkkkK.......",
  ".........KhhhhhhK.......",
  ".........mHhhhHhh.......",
  ".........mHsysses.......",
  ".........mSssssss.......",
  "..........Sssffs........"
];
var TORSO = [
  "......TmmmtttttttT......",
  "...TmmttttttttttttttT...",
  "...TmtttttttttttttttT...",
  "...TttttttttttttttttT...",
  "...TttttttttttttttttT...",
  "....TttttttttttttttT....",
  "....TttttttttttttttT....",
  ".....TttttttttttttT.....",
  ".....TttttttmmmmttT.....",
  ".....TttttttmmmmttT.....",
  "......TttttttttttT......",
  "......TttttttttttT......",
  "......qppppppppppq......"
];
var LEGS_STAND2 = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......spp....pps.......",
  ".......bbb....bbb.......",
  "......bbbb....bbbb......",
  "......BBBB....BBBB......"
];
var LEGS_STRIDE2 = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  ".....qpppp..ppppq.......",
  ".....qpppp...ppppq......",
  "....qpppp....ppppq......",
  "....qppp......pppq......",
  "....qppp......pppq......",
  "...qppp........pppq.....",
  "...qppp........pppq.....",
  "...qppp........pppq.....",
  "..qppp..........pppq....",
  "..qppp..........pppq....",
  "..qpp............ppq....",
  "..qpp............ppq....",
  "..spp............pps....",
  "..bbb............bbb....",
  ".bbbb............bbbb...",
  ".BBBB............BBBB..."
];
var LEGS_PASS2 = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qppQQpppppq.......",
  "......qppQQpppppq.......",
  ".......qpQQppppq........",
  ".......qpQQppppq........",
  ".......qpQQpppq.........",
  ".......qpQQpppq.........",
  ".......qpQ.pppq.........",
  ".......qpQ.pppq.........",
  ".......qpQ.ppq..........",
  ".......qpQ.ppq..........",
  "........qQ.ppq..........",
  "........qQ.ppq..........",
  "........sQ.pps..........",
  "........bb.bbb..........",
  ".......bbb.bbbb.........",
  ".......BBB.BBBB........."
];
var LEGS_STRIDE_LOW = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  ".....qpppp...ppppq......",
  ".....qppp.....pppq......",
  "....qppp......pppq......",
  "....qppp.......pppq.....",
  "....qppp.......pppq.....",
  "...qppp.........pppq....",
  "...qppp.........pppq....",
  "...qpp...........ppq....",
  "...qpp...........ppq....",
  "...qpp...........ppq....",
  "...qpp...........ppq....",
  "...spp...........pps....",
  "...bbb...........bbb....",
  "..bbbb...........bbbb...",
  "..BBBB...........BBBB..."
];
var LEGS_BENT2 = [
  "........................",
  "........................",
  "......qppppppppppq......",
  ".....qppppppppppppq.....",
  ".....qppppppppppppq.....",
  ".....qpppppppppppq......",
  ".....qppppp..ppppq......",
  "....qppppp....ppppq.....",
  "....qpppp......pppq.....",
  "....qppp.......pppq.....",
  "....qppp.......pppq.....",
  "....qppp.......pppq.....",
  "....qpp.........ppq.....",
  "....qpp.........ppq.....",
  "....spp.........pps.....",
  "....bbb.........bbb.....",
  "...bbbb.........bbbb....",
  "...BBBB.........BBBB...."
];
var LEGS_SIT = [
  "........................",
  "........................",
  "........................",
  "........................",
  "......qppppppppppq......",
  "......qpppppppppppppq...",
  "......qppppppppppppppq..",
  "......qppppppppppppppq..",
  "................qppppq..",
  "................qppppq..",
  "................qppppq..",
  "................qpppq...",
  "................qpppq...",
  "................qpppq...",
  "................spps....",
  "................bbbb....",
  "...............bbbbbb...",
  "...............BBBBBB..."
];
var LEGS_TIPTOE2 = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......spp....pps.......",
  ".......bbb....bbb.......",
  ".......bb......bb......."
];
var LEGS_KNEEL = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......ppp....ppp.......",
  "....qqppp...qppp........",
  "..ppppp...ppppp.........",
  "..bbb.....bbb...........",
  "..BBB.....BBB..........."
];
var BACK_HEAD = [
  "........................",
  ".........KkkkkkkK.......",
  ".........HhhhhhhH.......",
  ".........hhhhhhhh.......",
  ".........hhhhhhhh.......",
  ".........HhhhhhhH.......",
  "..........Ssssss........"
];
var BACK_TORSO = [
  "......TtttmmmmtttT......",
  "...TtttttmmmmmmtttttT...",
  "...TtttttmMMMMmtttttT...",
  "...TttttttMMMMttttttT...",
  "...TttttttttttttttttT...",
  "....TttttttttttttttT....",
  "....TttttttttttttttT....",
  ".....TttttttttttttT.....",
  ".....TttttttttttttT.....",
  "......TttttttttttT......",
  "......TttttttttttT......",
  "......TttttttttttT......",
  "......qppppppppppq......"
];
var BACK_LEGS_KNEEL = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  "......bqppp..pppqb......",
  ".....bBqppp..pppqBb.....",
  ".....BBqppp..pppqBB.....",
  ".......qppp..pppq......."
];
var BACK_TORSO_BARE = [
  "......SssssssssssS......",
  "...SsyyssssssssssyysS...",
  "...SsyyssssssssssyysS...",
  "...SsssssssSSsssssssS...",
  "...SsssssssSSsssssssS...",
  "....SssssssSSssssssS....",
  "....SssssssSSssssssS....",
  ".....SsssssSSsssssS.....",
  ".....SssssssssssssS.....",
  "......SssssssssssS......",
  "......SssssssssssS......",
  "......SssssssssssS......",
  "......SssssssssssS......"
];
var BACK_LEGS_BARE = [
  "......SssssssssssS......",
  "......SssssssssssS......",
  "......Sssss..ssssS......",
  "......Sssss..ssssS......",
  "......Sssss..ssssS......",
  "......Sssss..ssssS......",
  ".......Ssss..sssS.......",
  ".......Ssss..sssS.......",
  ".......Ssss..sssS.......",
  ".......Ssss..sssS.......",
  ".......Sss....ssS.......",
  ".......Sss....ssS.......",
  ".......Sss....ssS.......",
  ".......Sss....ssS.......",
  ".......sss....sss.......",
  ".......sss....sss.......",
  "......ssss....ssss......",
  "......SSSS....SSSS......"
];
var waterRows = (off) => Array.from({ length: 32 }, (_, i) => (i + off) % 2 === 0 ? "c...c...c" : ".........");
var LEGS_IDLE_SHIFT = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppqq......",
  ".......qppp..qpppq......",
  ".......qpp....qppq......",
  ".......qpp....qppq......",
  ".......qpp.....ppq......",
  ".......qpp.....ppq......",
  ".......spp.....pps......",
  ".......bbb.....bbb......",
  "......bbbb.....bbbb.....",
  "......BBBB.....BBBB....."
];
var P = {
  farArm: {
    r: 8,
    c: 2,
    rows: ["Tt", "Tt", "TS", "SS", "SS", "SS", ".S", ".S", "SS", "SS", ".S", ".S", ".S", ".S"]
  },
  armDown: {
    r: 8,
    c: 19,
    rows: [
      "ttt",
      "ttt",
      "tss",
      "sys",
      "sys",
      "sss",
      ".ss",
      ".ss",
      "sss",
      "sss",
      ".ss",
      ".ss",
      ".sS",
      ".SS"
    ]
  },
  farArmFwd: {
    r: 8,
    c: 3,
    rows: ["Tt", "Tt", "TS", "SS", ".S", ".S", "SS", "SS", ".S", ".S"]
  },
  farArmBack: {
    r: 8,
    c: 1,
    rows: [".Tt", ".Tt", "TS.", "SS.", "S..", "S..", "S..", "S..", "S..", "S.."]
  },
  armSwingFwd: {
    r: 8,
    c: 20,
    rows: ["tt.", "tt.", "ss.", "ss.", "ss.", ".ss", ".ss", ".ss", ".ss", ".sS"]
  },
  armSwingBack: {
    r: 8,
    c: 15,
    rows: [
      "...ttt",
      "...ttt",
      "..tss.",
      "..sss.",
      ".sss..",
      ".ss...",
      "ss....",
      "ss....",
      "sS....",
      "S....."
    ]
  },
  armReach: {
    r: 6,
    c: 18,
    rows: ["...ss", "..sss", ".sss.", "ttt..", "ttt.."]
  },
  armUpBoth: {
    r: 2,
    c: 4,
    rows: [
      "s...............s",
      "s...............s",
      "S...............s",
      "S...............s",
      "t...............t",
      "tt.............tt"
    ]
  },
  armPhone: {
    r: 5,
    c: 17,
    rows: ["...cc", "..sss", ".sss.", "tss..", "tt..."]
  },
  armMug: { r: 10, c: 18, rows: [".ccc", ".sss", "sss.", "tt.."] },
  armMugUp: {
    r: 6,
    c: 16,
    rows: ["..ccc", "..sss", "..ss.", ".ss..", "tt..."]
  },
  // forearms converging to clasped hands at the waist
  handsFold: {
    r: 12,
    c: 3,
    rows: [
      "SS..............ss",
      "SSS............sss",
      ".SSs........ssss..",
      "..sssssssssss.....",
      "...ssssssss......."
    ]
  },
  armGuardHigh: {
    r: 6,
    c: 16,
    rows: ["..sss", ".sss.", "tss..", "ttt..", "tt..."]
  },
  armGuardLow: {
    r: 10,
    c: 17,
    rows: ["ssss", "sss.", "tt..", "t..."]
  },
  cigLean: { r: 9, c: 19, rows: ["ttt", "tss", "sss", ".sc", "..o"] },
  // the smoke cycle: cig at the hip, halfway up, and at the lips
  armCigDown: {
    r: 8,
    c: 19,
    rows: [
      "ttt",
      "ttt",
      "tss",
      "sys",
      "sys",
      "sss",
      ".ss",
      ".ss",
      "sss",
      "sss",
      ".ss",
      ".ss",
      ".sc",
      "..o"
    ]
  },
  armCigHalf: {
    r: 7,
    c: 17,
    rows: ["....", "ss..", "ssco", "ts..", "tt..", "tt.."]
  },
  // the guitar, slung across the body: honeyed top (w/W), dark neck rising
  // forward to the headstock, soundhole toward the bridge. Drawn over the
  // shirt; the fretting hand and the strumming arm patch on top of it.
  guitarBody: {
    r: 7,
    c: 5,
    rows: [
      "................nnR",
      "...............WWn.",
      "..............WW...",
      ".............WW....",
      "............WW.....",
      "...........WW......",
      ".WwwwwwwwwWW.......",
      "Wwwwwwwwwwwww......",
      "WwwwnnwwwwwRw......",
      "Wwwwwwwwwwwww......",
      "WWwwwwwwwwwwW......",
      ".WWWWWWWWWWWW......"
    ]
  },
  // fretting hand gripping the neck just under the headstock (patched LAST,
  // over both the neck and the strumming arm, so the fingers stay visible)
  gtrFret: { r: 8, c: 20, rows: ["ss", "sS"] },
  // one position lower — the chord change
  gtrFretLow: { r: 10, c: 18, rows: ["ss", "sS"] },
  // strumming arm at the top of the stroke, hand over the upper bout
  gtrStrumUp: {
    r: 8,
    c: 10,
    rows: [
      "........ttt",
      "........tt.",
      ".........s.",
      "........s..",
      ".....sss...",
      ".ssss......"
    ]
  },
  // and swept through to the lower bout
  gtrStrumDown: {
    r: 8,
    c: 10,
    rows: [
      "........ttt",
      "........tt.",
      ".........s.",
      "........s..",
      "........s..",
      ".......s...",
      ".....ss....",
      "..sss......",
      ".ss........"
    ]
  },
  // back view: both arms hanging at the silhouette edges
  backArms: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................st",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".S................S."
    ]
  },
  // back view: elbows tuck in, forearms vanish forward — hands folded in prayer
  backArmsFold: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................st",
      ".ss..............ss.",
      "..ss............ss..",
      "...s............s..."
    ]
  },
  // shower: bare arms hanging at the silhouette
  bareArmsDown: {
    r: 8,
    c: 2,
    rows: [
      "ss................ss",
      "ss................ss",
      "ss................ss",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".S................S."
    ]
  },
  // right arm up to the shower tap, left hanging
  showerTapArm: {
    r: 3,
    c: 2,
    rows: [
      "...............ss...",
      "...............ss...",
      "................ss..",
      ".................s..",
      ".................s..",
      "ss................s.",
      "ss..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".S.................."
    ]
  },
  // both hands on the head — on the clothed torso this reads as a shirt
  // coming off over the head; on the bare one, as washing the hair
  washHairBoth: {
    r: 2,
    c: 4,
    rows: [
      "....ss....ss....",
      "...ss......ss...",
      "..ss........ss..",
      ".ss..........ss.",
      "ss............ss",
      "s..............s"
    ]
  },
  // hands scrubbing the ribs, elbows wide
  scrubTorso: {
    r: 8,
    c: 3,
    rows: [
      "s................s",
      "ss..............ss",
      ".ss............ss.",
      "..ss..........ss..",
      "...ss........ss..."
    ]
  },
  // the towel, wrapped where a towel goes
  towelWrap: {
    r: 19,
    c: 6,
    rows: ["cccccccccccc", "cccccccccccc", ".cccccccccc."]
  },
  // the clothes, where clothes actually land
  clothesPile: {
    r: 34,
    c: 1,
    rows: ["..ttt", "ttttp", "tpppp"]
  },
  waterA: { r: 2, c: 8, rows: waterRows(0) },
  waterB: { r: 2, c: 8, rows: waterRows(1) },
  // pee stance: elbows out a little, forearms angling forward and down,
  // hands vanishing in front — everything stays off-screen except posture
  peeArms: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................st",
      ".ss..............ss.",
      "..s..............s..",
      "..ss............ss..",
      "...s............s..."
    ]
  },
  // back view, sign of the cross: right hand up beside the head (forehead)
  backCrossHigh: {
    r: 3,
    c: 2,
    rows: [
      "...............ss...",
      "...............ss...",
      "................ss..",
      "................ss..",
      ".................s..",
      "tt................tt",
      "tt................tt",
      "ts..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".S.................."
    ]
  },
  // ...elbow winging out high — the hand crosses to the far shoulder
  backCrossL: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt...............sss",
      "ts................ss",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".S.................."
    ]
  },
  // ...and low — the hand at the near shoulder
  backCrossR: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................ss",
      ".s...............sss",
      ".s................s.",
      ".s..................",
      ".s..................",
      ".S.................."
    ]
  },
  // sign of the cross — four stations of the right hand
  crossForehead: {
    r: 2,
    c: 15,
    rows: ["..ss", ".sss", ".ss.", ".ss.", "ss..", "ss..", "ts..", "tt.."]
  },
  crossChest: {
    r: 8,
    c: 12,
    rows: ["....tt", "...tss", "..sss.", ".ss...", "ss...."]
  },
  crossFar: {
    r: 8,
    c: 4,
    rows: [".............tt", ".........sssss.", "....sssss......", "..sss.........."]
  },
  crossNear: {
    r: 8,
    c: 13,
    rows: ["..sst", ".sss.", "ss..."]
  },
  armReachHalf: {
    r: 7,
    c: 18,
    rows: ["..ss", ".sss", "tss.", "tt..", "tt.."]
  },
  // petting the dog — final-space arms that actually reach his back
  armPetA: {
    r: 12,
    c: 16,
    rows: [
      "tt...",
      "ts...",
      "ss...",
      ".ss..",
      ".ss..",
      ".ss..",
      "..ss.",
      "..ss.",
      "..ss.",
      "..ss.",
      "...ss",
      "...ss",
      "...ss",
      "...ss",
      "...ss",
      "...ss",
      "...sS",
      "...SS"
    ]
  },
  armPetB: {
    r: 12,
    c: 14,
    rows: [
      "..tt.",
      "..ts.",
      ".ss..",
      ".ss..",
      "ss...",
      "ss...",
      "ss...",
      ".ss..",
      ".ss..",
      ".ss..",
      ".ss..",
      "..ss.",
      "..ss.",
      "..ss.",
      "..ss.",
      "..sS.",
      "..SS."
    ]
  },
  // scratch behind the ear: short fast wiggle near the dog's head
  armScratchA: {
    r: 12,
    c: 15,
    rows: [
      "tt..",
      "ts..",
      "ss..",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      "..ss",
      "..sS",
      "..s."
    ]
  },
  armScratchB: {
    r: 12,
    c: 15,
    rows: [
      "tt..",
      "ts..",
      "ss..",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      "..ss",
      "..ss",
      "..Ss",
      "...s"
    ]
  },
  // kettlebell passing the knees on its arc
  giriaMid: {
    r: 9,
    c: 6,
    rows: [
      "t............t",
      "s............s",
      ".s..........s.",
      ".s..........s.",
      "..s........s..",
      "..s........s..",
      "...sGGGGGGs...",
      "...gggggggg...",
      "....gggggg...."
    ]
  },
  // kettlebell stations in FINAL frame space (patched after pose transforms)
  giriaFloor: {
    r: 11,
    c: 6,
    rows: [
      "s..........s",
      "s..........s",
      ".s........s.",
      ".s........s.",
      ".s........s.",
      "..s......s..",
      "..s......s..",
      "..s......s..",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...sGGGGs...",
      "....gggg....",
      "...gggggg...",
      "...gggggg...",
      "....gggg...."
    ]
  },
  giriaBack: {
    r: 11,
    c: 2,
    rows: [
      "........s......s",
      ".......s......s.",
      "......s.....s...",
      ".....s.....s....",
      "....s.....s.....",
      "...s.....s......",
      "...s....s.......",
      "..s....s........",
      "..s...s.........",
      ".s...s..........",
      ".s..s...........",
      ".sGGs...........",
      "gggg............",
      "gggggg..........",
      "gggggg..........",
      ".gggg..........."
    ]
  },
  giriaHang: {
    r: 11,
    c: 6,
    rows: [
      "s..........s",
      "s..........s",
      ".s........s.",
      ".s........s.",
      "..s......s..",
      "..s......s..",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...sGGGGs...",
      "....gggg....",
      "...gggggg...",
      "...gggggg...",
      "....gggg...."
    ]
  },
  giriaChest: {
    r: 9,
    c: 6,
    rows: ["ssssssssssssGGGG", "ssssssssssssgggg", "............gggg", ".............gg."]
  },
  armCigLips: {
    r: 5,
    c: 16,
    rows: ["sco", "ss.", "ss.", "ts.", "tt.", "tt."]
  },
  // the coal lights the face on the draw: a halo around the ember, one warm
  // pixel on the brow and the lip — quantized light, one tier, no gradients
  emberFace: {
    r: 4,
    c: 16,
    rows: ["y.xx", "y..x", "..x."]
  },
  // the deep drag: the halo widens while the core burns white (smokeD swaps o→c)
  emberFlare: {
    r: 4,
    c: 16,
    rows: ["yyxx", "y.xx", ".xx."]
  },
  // the cigarette smokes itself at the hip — a thin curl, two phases so it
  // wavers between frames the way the water alternates in the shower
  wispA: {
    r: 9,
    c: 21,
    rows: [".v.", "..v", ".v.", "..v", ".v.", ".v.", "..v", ".v.", "..v", ".v."]
  },
  wispB: {
    r: 9,
    c: 21,
    rows: ["..v", ".v.", "..v", ".v.", "..v", "..v", ".v.", "..v", ".v.", "..v"]
  },
  // the exhale: dense at the lips, then dispersed and climbing
  puffA: {
    r: 1,
    c: 16,
    rows: ["..vv...", ".vvvv..", "..vvv..", "...vv..", "....v.."]
  },
  puffB: {
    r: 0,
    c: 17,
    rows: [".v.v.v.", "v.vvv.v", ".v.v.v.", "...v...", "......."]
  },
  // kettlebell, two-handed: arms straight down to the bell between the knees,
  // then swung out to chest height on the way up
  giriaLow: {
    r: 9,
    c: 4,
    rows: [
      "t..............t",
      "s..............s",
      "s..............s",
      ".s............s.",
      ".s............s.",
      "..s..........s..",
      "..s..........s..",
      "..s..........s..",
      "..s..........s..",
      "...sGGGGGGGGs...",
      "....gggggggg....",
      "....gggggggg....",
      ".....gggggg....."
    ]
  },
  giriaHigh: {
    r: 6,
    c: 14,
    rows: ["....ss..", "...sGGs.", "..sgggg.", "tssgggg.", "tt.gg..."]
  },
  // barbell across the frame: bar R with plates P, full 24 columns
  barRack: {
    r: 10,
    c: 0,
    rows: ["PP..RRRRRRRRRRRRRRRR..PP", "PP....................PP"]
  },
  barUp: {
    r: 1,
    c: 0,
    rows: ["PP..RRRRRRRRRRRRRRRR..PP", "PP....................PP"]
  },
  armsRack: {
    r: 10,
    c: 4,
    rows: ["s..............s", "s..............s", "t..............t", "t..............t"]
  },
  armsUp: {
    r: 2,
    c: 5,
    rows: [
      "s............s",
      "s............s",
      "s............s",
      "S............s",
      "t............t",
      "tt..........tt"
    ]
  }
};
var LYING_A = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..hhhh...........uuu....",
  ".hhhhhh..uuuuuuuuuuuu...",
  ".hssssh.uuuuuuuuuuuuuu..",
  ".hsSsShuuuuuuuuuuuuuuuu.",
  ".hsssshuuussssuuuuuuuuU.",
  "..ssss.uuuuuuuuuuuuuuuU.",
  "......Uuuuuuuuuuuuuuuu..",
  "......Uuuuuuuuuuuuuuuu..",
  ".....UUuuuuuuuuuuuuuuU..",
  ".....UUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................"
];
var LYING_B = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..hhhh...uuuuu...uuu....",
  ".hhhhhh.uuuuuuuuuuuuu...",
  ".hssssh.uuuuuuuuuuuuuu..",
  ".hsSsShuuuuuuuuuuuuuuuu.",
  ".hsssshuuussssuuuuuuuuU.",
  "..ssss.uuuuuuuuuuuuuuuU.",
  "......Uuuuuuuuuuuuuuuu..",
  "......Uuuuuuuuuuuuuuuu..",
  ".....UUuuuuuuuuuuuuuuU..",
  ".....UUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................"
];
var LYING_SIDE = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..hhhh......uuu..uuu....",
  ".hhhhhh..uuuuuuuuuuuu...",
  ".hhhssh.uuuuuuuuuuuuuu..",
  ".hhssShuuuuuuuuuuuuuuuu.",
  ".hhssshuuuuuuuuuuuuuuuU.",
  "..sss..uuuuuuuuuuuuuuuU.",
  "......Uuuuuuuuuuuuuuuu..",
  "......Uuuuuuuuuuuuuuuu..",
  ".....UUuuuuuuuuuuuuuuU..",
  ".....UUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................"
];
var LYING_SIT = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "...hhhh.................",
  "..hhhhhh................",
  "..hssssh................",
  "..hseseh................",
  "..hssssh................",
  "...ssss.................",
  "..tttttt................",
  ".tttttttt...............",
  ".tttttttt...............",
  ".stttttts...............",
  ".stttttts...............",
  ".stttttts...............",
  "..s....s................",
  "..uuuuuuuuuuuuuuuuuuuu..",
  ".uuuuuuuuuuuuuuuuuuuuU..",
  ".uuuuuuuuuuuuuuuuuuuuU..",
  ".UUUUUUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................"
];
function bowHead(map, depth = 1, top = 0) {
  const width = map[0]?.length ?? 24;
  const empty = ".".repeat(width);
  const before = map.slice(0, top);
  const head = map.slice(top, top + 7);
  const after = map.slice(top + 7);
  return [
    ...before,
    ...Array.from({ length: depth }, () => empty),
    ...head.slice(0, head.length - depth),
    ...after
  ];
}
function dropBody(map, depth) {
  const width = map[0]?.length ?? 24;
  const empty = ".".repeat(width);
  const body = map.slice(0, 20 - depth);
  const legs = map.slice(20);
  const dropped = [...Array.from({ length: depth }, () => empty), ...body];
  const overlapTop = map.slice(20 - depth, 20);
  const merged = legs.map((legRow, i) => {
    if (i >= depth) return legRow;
    const bodyRow = overlapTop[i] ?? empty;
    return legRow.split("").map((ch, c) => ch === "." || ch === " " ? bodyRow[c] ?? "." : ch).join("");
  });
  return [...dropped, ...merged];
}
function raiseChin(map, top = 0) {
  const width = map[0]?.length ?? 24;
  const empty = ".".repeat(width);
  const before = map.slice(0, top);
  const head = map.slice(top, top + 7);
  const after = map.slice(top + 7);
  return [...before, ...head.slice(1), empty, ...after];
}
var b = createCharacter({ palette: PLAYER_PALETTE, cell: 2, walkSpeed: 72 });
b.part("head", HEAD).part("torso", TORSO).part("legsStand", LEGS_STAND2).part("legsStride", LEGS_STRIDE2).part("legsPass", LEGS_PASS2).part("legsStrideLow", LEGS_STRIDE_LOW).part("legsBent", LEGS_BENT2).part("legsSit", LEGS_SIT).part("legsKneel", LEGS_KNEEL).part("backHead", BACK_HEAD).part("backTorso", BACK_TORSO).part("backLegsKneel", BACK_LEGS_KNEEL).part("backTorsoBare", BACK_TORSO_BARE).part("backLegsBare", BACK_LEGS_BARE).part("legsIdleShift", LEGS_IDLE_SHIFT).part("legsTiptoe", LEGS_TIPTOE2);
var base = (legs) => (f) => f.stack("head", "torso", legs).patch(P.farArm);
b.frame("stand", (f) => base("legsStand")(f).patch(P.armDown));
b.variant("idleB", "stand", (m) => dropBody(m, 1));
b.variant("blink", "stand", (m) => replaceColor(m, "e", "s"));
b.variant("lookBack", "stand", (m) => mirrorRows(m, 0, 6));
b.frame(
  "leanIdle",
  (f) => f.stack("head", "torso", "legsIdleShift").patch(P.farArm).patch(P.armSwingBack)
);
b.frame("stretchA", (f) => base("legsStand")(f).patch(P.armUpBoth));
b.frame("stretchB", (f) => base("legsTiptoe")(f).patch(P.armUpBoth));
b.frame(
  "squat",
  (f) => base("legsBent")(f).patch(P.armDown).map((m) => dropBody(m, 2))
);
b.frame(
  "stride",
  (f) => f.stack("head", "torso", "legsStride").patch(P.farArmFwd).patch(P.armSwingBack)
);
b.frame("pass", (f) => base("legsPass")(f).patch(P.armDown));
b.frame(
  "strideLow",
  (f) => f.stack("head", "torso", "legsStrideLow").patch(P.farArmBack).patch(P.armSwingFwd).map((m) => dropBody(m, 1))
);
b.frame(
  "reach",
  (f) => base("legsStand")(f).map((m) => bowHead(m)).patch(P.armReach)
);
b.frame(
  "sit",
  (f) => f.stack("head", "torso", "legsSit").patch(P.farArm).patch(P.armDown).map((m) => dropBody(m, 4))
);
b.variant("sitBack", "sit", (m) => bowHead(dropBody(m, 1), 1, 5));
b.frame(
  "sitSlouch",
  (f) => f.stack("head", "torso", "legsSit").patch(P.farArm).map((m) => bowHead(dropBody(m, 5), 2, 5)).patch({ r: 14, c: 15, rows: ["tt.", "ss.", "ss.", ".ss", ".ss", ".sS"] })
);
b.frame(
  "sitCross",
  (f) => f.stack("head", "torso", "legsSit").patch(P.farArm).patch(P.armDown).map((m) => dropBody(m, 4)).patch({ r: 27, c: 6, rows: ["....ppppp", "pppppp...", "bb......."] })
);
b.frame("bedLie", (f) => f.raw(LYING_A));
b.frame("bedLieB", (f) => f.raw(LYING_B));
b.frame("bedSide", (f) => f.raw(LYING_SIDE));
b.frame("bedSitUp", (f) => f.raw(LYING_SIT));
b.frame(
  "crouch",
  (f) => base("legsBent")(f).patch(P.armDown).map((m) => dropBody(m, 2))
);
b.variant("crouchB", "crouch", (m) => bowHead(m, 1, 2));
b.frame(
  "swingSetup",
  (f) => f.stack("head", "torso", "legsBent").map((m) => bowHead(dropBody(m, 2), 2, 2)).patch(P.giriaFloor)
);
b.frame(
  "swingHike",
  (f) => f.stack("head", "torso", "legsBent").map((m) => bowHead(dropBody(m, 2), 2, 2)).patch(P.giriaBack)
);
b.frame(
  "swingDown",
  (f) => f.stack("head", "torso", "legsBent").patch(P.giriaLow).map((m) => bowHead(dropBody(m, 2), 1, 2))
);
b.frame("swingUp", (f) => f.stack("head", "torso", "legsStand").patch(P.giriaChest));
b.frame(
  "pressRack",
  (f) => f.stack("head", "torso", "legsStand").patch(P.armsRack).patch(P.barRack)
);
b.frame(
  "pressDip",
  (f) => f.stack("head", "torso", "legsBent").patch(P.armsRack).patch(P.barRack).map((m) => dropBody(m, 2))
);
b.frame("pressUp", (f) => f.stack("head", "torso", "legsStand").patch(P.armsUp).patch(P.barUp));
b.frame("samboA", (f) => base("legsStride")(f).patch(P.armGuardHigh));
b.frame(
  "samboB",
  (f) => base("legsBent")(f).patch(P.armGuardLow).map((m) => dropBody(m, 2))
);
b.frame(
  "samboC",
  (f) => base("legsBent")(f).patch(P.armGuardHigh).map((m) => dropBody(m, 2))
);
b.frame("phoneA", (f) => base("legsStand")(f).patch(P.armPhone));
b.variant("phoneB", "phoneA", (m) => bowHead(m));
b.frame("drinkA", (f) => base("legsStand")(f).patch(P.armMug));
b.frame("drinkB", (f) => base("legsStand")(f).patch(P.armMugUp));
b.variant("drinkD", "drinkB", (m) => raiseChin(m));
b.frame("crossA", (f) => base("legsStand")(f).patch(P.crossForehead));
b.frame("crossB", (f) => base("legsStand")(f).patch(P.crossChest));
b.frame("crossC", (f) => base("legsStand")(f).patch(P.crossFar));
b.frame("crossD", (f) => base("legsStand")(f).patch(P.crossNear));
b.frame(
  "kneel",
  (f) => f.stack("head", "torso", "legsKneel").patch(P.farArm).patch(P.handsFold).map((m) => dropBody(m, 6))
);
b.variant("kneelBow", "kneel", (m) => bowHead(m, 1, 6));
b.variant("kneelDeep", "kneel", (m) => bowHead(m, 2, 6));
b.frame("backStand", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backArms));
b.frame(
  "backPray",
  (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backArmsFold).map((m) => bowHead(m, 1))
);
b.frame(
  "backCrossHead",
  (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backCrossHigh)
);
b.frame("backCrossL", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backCrossL));
b.frame("backCrossR", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backCrossR));
b.frame(
  "backKneel",
  (f) => f.stack("backHead", "backTorso", "backLegsKneel").patch(P.backArmsFold).map((m) => dropBody(m, 6))
);
b.variant("backKneelBow", "backKneel", (m) => bowHead(m, 1, 6));
b.variant("backKneelDeep", "backKneel", (m) => bowHead(m, 2, 6));
b.frame(
  "undress",
  (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.washHairBoth).map((m) => bowHead(m, 1))
);
var bareHead = (m) => replaceColor(replaceColor(m, "k", "h"), "K", "H");
b.frame(
  "showerIdle",
  (f) => f.stack("backHead", "backTorsoBare", "backLegsBare").map(bareHead).patch(P.bareArmsDown).patch(P.clothesPile)
);
b.frame(
  "showerTap",
  (f) => f.stack("backHead", "backTorsoBare", "backLegsBare").map(bareHead).patch(P.showerTapArm).patch(P.clothesPile)
);
b.frame(
  "washHairA",
  (f) => f.stack("backHead", "backTorsoBare", "backLegsBare").map(bareHead).patch(P.washHairBoth).patch(P.clothesPile).map((m) => bowHead(m, 1)).patch(P.waterA)
);
b.frame(
  "washHairB",
  (f) => f.stack("backHead", "backTorsoBare", "backLegsBare").map(bareHead).patch(P.washHairBoth).patch(P.clothesPile).patch(P.waterB)
);
b.frame(
  "scrubA",
  (f) => f.stack("backHead", "backTorsoBare", "backLegsBare").map(bareHead).patch(P.scrubTorso).patch(P.clothesPile).patch(P.waterA)
);
b.variant("scrubB", "scrubA", (m) => bowHead(m, 1));
b.frame(
  "rinse",
  (f) => f.stack("backHead", "backTorsoBare", "backLegsBare").map(bareHead).patch(P.bareArmsDown).patch(P.clothesPile).map((m) => raiseChin(m)).patch(P.waterB)
);
b.frame(
  "towelOut",
  (f) => f.stack("backHead", "backTorsoBare", "backLegsBare").map(bareHead).patch(P.bareArmsDown).patch(P.towelWrap)
);
b.frame("peeStand", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.peeArms));
b.variant("peeBow", "peeStand", (m) => bowHead(m, 1));
b.variant("peeUp", "peeStand", (m) => raiseChin(m));
b.frame("peeShift", (f) => f.stack("backHead", "backTorso", "legsIdleShift").patch(P.peeArms));
b.frame(
  "peeFlush",
  (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backArmsFold).map((m) => bowHead(m, 1))
);
b.frame("leanA", (f) => base("legsStand")(f).patch(P.cigLean));
b.variant("leanB", "leanA", (m) => bowHead(m));
b.frame("reachHalf", (f) => base("legsStand")(f).patch(P.armReachHalf));
b.frame(
  "petA",
  (f) => f.stack("head", "torso", "legsBent").patch(P.farArm).map((m) => bowHead(dropBody(m, 2), 1, 2)).patch(P.armPetA)
);
b.frame(
  "petB",
  (f) => f.stack("head", "torso", "legsBent").patch(P.farArm).map((m) => bowHead(dropBody(m, 2), 1, 2)).patch(P.armPetB)
);
b.frame(
  "scratchA",
  (f) => f.stack("head", "torso", "legsBent").patch(P.farArm).map((m) => bowHead(dropBody(m, 2), 1, 2)).patch(P.armScratchA)
);
b.frame(
  "scratchB",
  (f) => f.stack("head", "torso", "legsBent").patch(P.farArm).map((m) => bowHead(dropBody(m, 2), 2, 2)).patch(P.armScratchB)
);
b.frame(
  "ruffle",
  (f) => f.stack("head", "torso", "legsBent").map((m) => bowHead(dropBody(m, 2), 2, 2)).patch(P.armPetA).patch({
    r: 14,
    c: 6,
    rows: [
      "s..",
      "s..",
      ".s.",
      ".s.",
      ".s.",
      ".ss",
      ".ss",
      "..s",
      "..s",
      "..s",
      "..s",
      "..s",
      "..s",
      "..s",
      "..S"
    ]
  })
);
b.frame(
  "swingMid",
  (f) => f.stack("head", "torso", "legsBent").patch(P.giriaMid).map((m) => dropBody(m, 1))
);
b.variant("drinkC", "drinkA", (m) => bowHead(m));
b.variant("phoneC", "phoneA", (m) => mirrorRows(m, 0, 6));
b.frame(
  "phoneD",
  (f) => f.stack("head", "torso", "legsIdleShift").patch(P.farArm).patch(P.armPhone)
);
b.frame(
  "gtrDown",
  (f) => f.stack("head", "torso", "legsStand").patch(P.guitarBody).patch(P.gtrStrumDown).patch(P.gtrFret)
);
b.frame(
  "gtrUp",
  (f) => f.stack("head", "torso", "legsStand").patch(P.guitarBody).patch(P.gtrStrumUp).patch(P.gtrFret)
);
b.frame(
  "gtrChord",
  (f) => f.stack("head", "torso", "legsStand").patch(P.guitarBody).patch(P.gtrStrumUp).patch(P.gtrFretLow)
);
b.frame(
  "gtrShift",
  (f) => f.stack("head", "torso", "legsIdleShift").patch(P.guitarBody).patch(P.gtrStrumDown).patch(P.gtrFret)
);
b.variant("gtrNodA", "gtrDown", (m) => bowHead(m));
b.variant("gtrNodB", "gtrUp", (m) => bowHead(m));
b.variant("gtrRing", "gtrUp", (m) => raiseChin(m));
b.frame("smokeA", (f) => base("legsStand")(f).patch(P.armCigDown).patch(P.wispA));
b.frame("smokeA2", (f) => base("legsStand")(f).patch(P.armCigDown).patch(P.wispB));
b.frame("smokeB", (f) => base("legsStand")(f).patch(P.armCigHalf));
b.frame("smokeC", (f) => base("legsStand")(f).patch(P.armCigLips).patch(P.emberFace));
b.frame(
  "smokeD",
  (f) => base("legsStand")(f).patch(P.armCigLips).patch(P.emberFlare).map((m) => replaceColor(m, "o", "c"))
);
b.variant("smokeE", "smokeA", (m) => bowHead(m));
b.frame(
  "smokeF",
  (f) => base("legsStand")(f).patch(P.armCigHalf).map((m) => raiseChin(m)).patch(P.puffA)
);
b.frame(
  "smokeF2",
  (f) => base("legsStand")(f).patch(P.armCigHalf).map((m) => raiseChin(m)).patch(P.puffB)
);
b.frame(
  "smokeH",
  (f) => f.stack("head", "torso", "legsIdleShift").patch(P.farArm).patch(P.armCigDown).patch(P.wispB)
);
b.walkCycle(...WALK_CYCLE);
var ACTION_OVERRIDES = {
  ...ACTIONS,
  use: { frames: ["reachHalf", "reach", "reach", "reachHalf"], frameMs: 150, loops: 1 },
  sit: {
    frames: [
      "crouch",
      "sit",
      "sit",
      "sitBack",
      "sitBack",
      "sitCross",
      "sitCross",
      "sitBack",
      "sit"
    ],
    frameMs: 520,
    loops: 1
  },
  lay: {
    frames: [
      "crouch",
      "sit",
      "bedSitUp",
      "bedLie",
      "bedLieB",
      "bedLie",
      "bedLieB",
      "bedSide",
      "bedSide",
      "bedLie",
      "bedLieB",
      "bedLie",
      "bedSitUp",
      "sit"
    ],
    frameMs: 560,
    loops: 1
  },
  pet: {
    frames: [
      "crouch",
      "petA",
      "petB",
      "petA",
      "petB",
      "scratchA",
      "scratchB",
      "scratchA",
      "scratchB",
      "scratchA",
      "petA",
      "ruffle",
      "ruffle",
      "petB",
      "crouchB"
    ],
    frameMs: 270,
    loops: 1,
    interruptible: true
  },
  drink: {
    frames: ["drinkA", "drinkB", "drinkD", "drinkD", "drinkB", "drinkC", "drinkA"],
    frameMs: 420,
    loops: 2
  },
  // Żabka counter rituals — the mug zone doubles as a paper cup and a bun
  coffee: {
    frames: ["drinkA", "drinkB", "drinkD", "drinkB", "drinkD", "drinkC", "drinkA"],
    frameMs: 460,
    loops: 2
  },
  // Alchemia's machines — all built from frames the rig already owns
  run: {
    frames: ["strideLow", "pass", "stride", "pass"],
    frameMs: 150,
    loops: 8,
    interruptible: true
  },
  cycle: {
    frames: ["crouch", "crouchB", "crouch", "crouchB"],
    frameMs: 220,
    loops: 5,
    interruptible: true
  },
  stretch: {
    frames: [
      "stretchA",
      "stretchB",
      "stretchB",
      "stretchA",
      "leanIdle",
      "stretchA",
      "stretchB",
      "stretchA"
    ],
    frameMs: 420,
    loops: 1,
    interruptible: true
  },
  pull: {
    frames: ["reach", "stretchB", "reach", "stretchB", "reach"],
    frameMs: 380,
    loops: 2,
    interruptible: true
  },
  squat: {
    frames: ["stand", "crouch", "crouch", "stand"],
    frameMs: 340,
    loops: 4,
    interruptible: true
  },
  deadlift: {
    frames: ["crouchB", "crouch", "stand", "stand", "crouch", "crouchB"],
    frameMs: 380,
    loops: 3,
    interruptible: true
  },
  hotdog: {
    frames: ["drinkA", "drinkC", "drinkA", "drinkC", "drinkA", "drinkB", "drinkC", "drinkA"],
    frameMs: 380,
    loops: 1
  },
  call: {
    frames: [
      "phoneA",
      "phoneB",
      "phoneA",
      "phoneD",
      "phoneD",
      "phoneC",
      "phoneD",
      "phoneA",
      "phoneB",
      "phoneA"
    ],
    frameMs: 900,
    loops: 2,
    interruptible: true
  },
  swing: {
    frames: [
      "swingSetup",
      "swingHike",
      "swingDown",
      "swingMid",
      "swingUp",
      "swingMid",
      "swingDown",
      "swingHike",
      "swingDown",
      "swingMid",
      "swingUp",
      "swingMid",
      "swingDown",
      "swingHike",
      "swingDown",
      "swingMid",
      "swingUp",
      "swingMid",
      "swingDown",
      "swingSetup"
    ],
    frameMs: 280,
    loops: 1,
    interruptible: true
  },
  press: {
    frames: ["pressRack", "pressDip", "pressUp", "pressUp", "pressDip", "pressRack"],
    frameMs: 360,
    loops: 2
  },
  sambo: {
    frames: ["samboA", "samboC", "samboB", "samboC", "samboA", "samboB"],
    frameMs: 260,
    loops: 2
  },
  // the whole rite, in the correct projection: a glance up at the icon, then
  // he turns INTO the scene (back to the camera), crosses himself — forehead,
  // chest, shoulder to shoulder — folds his hands, goes down on both knees,
  // bows three times and holds the deepest one, rises, crosses himself again
  // and turns back out.
  pray: {
    frames: [
      "lookBack",
      "backStand",
      "backCrossHead",
      "backStand",
      "backCrossR",
      "backCrossL",
      "backStand",
      "backPray",
      "backPray",
      "backKneel",
      "backKneelBow",
      "backKneelDeep",
      "backKneelDeep",
      "backKneelDeep",
      "backKneelBow",
      "backKneel",
      "backPray",
      "backCrossHead",
      "backCrossR",
      "backCrossL",
      "backStand",
      "lookBack",
      "stand"
    ],
    frameMs: 460,
    loops: 1,
    interruptible: true
  },
  // settle — raise — draw (coal lights the face) — deep drag (flare) — hold —
  // lower — exhale with the chin up, twice as the puff climbs — the cigarette
  // smokes itself at the hip — weight to the other foot — a look at the street
  smoke: {
    frames: [
      "smokeA",
      "smokeB",
      "smokeC",
      "smokeD",
      "smokeD",
      "smokeC",
      "smokeB",
      "smokeF",
      "smokeF2",
      "smokeA",
      "smokeA2",
      "smokeH",
      "smokeA2",
      "smokeE"
    ],
    frameMs: 400,
    loops: 2,
    interruptible: true
  },
  // the full wash: undress over the head, tap on, hair, ribs, rinse with the
  // chin up, tap off, towel, dressed again. Water alternates per frame.
  shower: {
    frames: [
      "backStand",
      "undress",
      "undress",
      "showerIdle",
      "showerTap",
      "washHairA",
      "washHairB",
      "washHairA",
      "washHairB",
      "scrubA",
      "scrubB",
      "scrubA",
      "washHairA",
      "washHairB",
      "rinse",
      "rinse",
      "showerTap",
      "towelOut",
      "towelOut",
      "undress",
      "backStand",
      "lookBack"
    ],
    frameMs: 380,
    loops: 1,
    interruptible: true
  },
  // stance — patience — the ceiling stare — shift — flush. Off-screen where it
  // counts, on-screen where it's funny.
  pee: {
    frames: [
      "backStand",
      "peeStand",
      "peeBow",
      "peeStand",
      "peeUp",
      "peeUp",
      "peeStand",
      "peeShift",
      "peeStand",
      "peeBow",
      "peeFlush",
      "peeFlush",
      "backStand",
      "lookBack"
    ],
    frameMs: 420,
    loops: 1,
    interruptible: true
  },
  // the whole performance: lift it off the wall, settle, two bars with the
  // eyes on the strings, the groove taking the head, a chord change, weight
  // to the back foot, the last chord rung out with the chin up — and back
  // on its hook. SFX strums are timed to these frames in the handler.
  strum: {
    frames: [
      "reachHalf",
      "reach",
      "gtrDown",
      "gtrDown",
      "gtrUp",
      "gtrDown",
      "gtrUp",
      "gtrDown",
      "gtrNodB",
      "gtrNodA",
      "gtrNodB",
      "gtrNodA",
      "gtrChord",
      "gtrUp",
      "gtrDown",
      "gtrUp",
      "gtrShift",
      "gtrNodB",
      "gtrNodA",
      "gtrDown",
      "gtrRing",
      "gtrRing",
      "gtrDown",
      "reachHalf"
    ],
    frameMs: 320,
    loops: 1,
    interruptible: true
  }
};
for (const [id, def] of Object.entries(ACTION_OVERRIDES)) {
  b.action(id, def);
}
var PLAYER = b.build();

// ../../../../tmp/wk.ts
var want = ["stand", "stride", "strideLow", "pass"];
var ruler = "0123456789012345678901234".slice(0, 24);
console.log("   " + want.map((w) => w.padEnd(25)).join(""));
console.log("   " + want.map(() => ruler + " ").join(""));
for (let r = 18; r < 38; r++) {
  console.log(
    String(r).padStart(2) + " " + want.map((w) => ((PLAYER.frames[w] ?? [])[r] ?? "").replace(/\./g, " ").padEnd(25)).join("")
  );
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
