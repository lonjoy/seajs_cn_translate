/**
 * Sea.js 2.0.1 | seajs.org/LICENSE.md
 */
(function(global, undefined) {

/**
 * 避免seajs多次加载
 */
// Avoid conflicting when `sea.js` is loaded multiple times
var _seajs = global.seajs
if (_seajs && _seajs.version) {
  return
}

/**
 * 曝露seajs到window全局
 */
var seajs = global.seajs = {
  // The current version of Sea.js being used
  version: "2.0.1"
}


/**
 * 工具包 - 语言增强
 */
/**
 * util-lang.js - The minimal language enhancement
 */

function isType(type) {
  return function(obj) {
    return Object.prototype.toString.call(obj) === "[object " + type + "]"
  }
}

var isObject = isType("Object")
var isString = isType("String")
var isArray = Array.isArray || isType("Array")
var isFunction = isType("Function")


/**
 * util-log.js - The tiny log function
 */

// The safe wrapper for `console.xxx` functions
// log("message") ==> console.log("message")
// log("message", "warn") ==> console.warn("message")
var log = seajs.log = function(msg, type) {

  global.console &&
      // Do NOT print `log(msg)` in non-debug mode
      (type || configData.debug) &&
      // Set the default value of type
      (console[type || (type = "log")]) &&
      // Call native method of console
      console[type](msg)
}


/**
 * 事件缓存堆
 */
/**
 * util-events.js - The minimal events support
 */

var eventsCache = seajs.events = {}

/**
 * 绑定一个事件到事件缓存堆里
 */
// Bind event
seajs.on = function(event, callback) {
  if (!callback) return seajs

  var list = eventsCache[event] || (eventsCache[event] = [])
  list.push(callback)

  return seajs
}

/**
 * 从事件缓存堆里删除一个事件
 * 如果没有指定event，则删除该事件下的所有方法
 * 如果event和callback，则清空事件缓存堆
 */
// Remove event. If `callback` is undefined, remove all callbacks for the
// event. If `event` and `callback` are both undefined, remove all callbacks
// for all events
seajs.off = function(event, callback) {
  // Remove *all* events
  if (!(event || callback)) {
    seajs.events = eventsCache = {}
    return seajs
  }

  var list = eventsCache[event]
  if (list) {
    if (callback) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
          list.splice(i, 1)
        }
      }
    }
    else {
      delete eventsCache[event]
    }
  }

  return seajs
}

/**
 * 从事件缓存堆里触发一个事件
 * event为事件名，对应事件缓存堆里的一个键
 * data为传递的参数
 */
// Emit event, firing all bound callbacks. Callbacks are passed the same
// arguments as `emit` is, apart from the event name
var emit = seajs.emit = function(event, data) {

  var list = eventsCache[event], fn

  if (list) {
    // Copy callback lists to prevent modification
    list = list.slice()

    // Execute event callbacks
    while ((fn = list.shift())) {
      fn(data)
    }
  }

  return seajs
}


/**
 * 工具包 - 路劲增强
 */

/**
 * util-path.js - The utilities for operating path such as id, uri
 */

var DIRNAME_RE = /[^?#]*\//

var DOT_RE = /\/\.\//g
var MULTIPLE_SLASH_RE = /([^:\/])\/\/+/g
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//

var URI_END_RE = /\?|\.(?:css|js)$|\/$/
var HASH_END_RE = /#$/

/**
 * 获得路径
 * dirname("a/b/c.js?t=123#xx/zz") 返回路径 "a/b/"
 */
// Extract the directory portion of a path
// dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
// ref: http://jsperf.com/regex-vs-split/2
function dirname(path) {
  return path.match(DIRNAME_RE)[0]
}

/**
 * 格式化路径
 * 删除路径多余符号
 * realpath("http://test.com/a//./b/../c") 返回 "http://test.com/a/c"
 */
// Canonicalize a path
// realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
function realpath(path) {
  // /a/b/./c/./d ==> /a/b/c/d
  path = path.replace(DOT_RE, "/")

  // "file:///a//b/c"  ==> "file:///a/b/c"
  // "http://a//b/c"   ==> "http://a/b/c"
  // "https://a//b/c"  ==> "https://a/b/c"
  // "/a/b//"          ==> "/a/b/"
  path = path.replace(MULTIPLE_SLASH_RE, "$1\/")

  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
  while (path.match(DOUBLE_DOT_RE)) {
    path = path.replace(DOUBLE_DOT_RE, "/")
  }

  return path
}

/**
 * 格式化uri
 * 把简写的uri正常化为可被调用的uri
 * normalize("path/to/a") 返回 "path/to/a.js"
 */
// Normalize an uri
// normalize("path/to/a") ==> "path/to/a.js"
function normalize(uri) {
  // Call realpath() before adding extension, so that most of uris will
  // contains no `.` and will just return in realpath() call
  uri = realpath(uri)

  // Add the default `.js` extension except that the uri ends with `#`
  if (HASH_END_RE.test(uri)) {
    uri = uri.slice(0, -1)
  }
  else if (!URI_END_RE.test(uri)) {
    uri += ".js"
  }

  // issue #256: fix `:80` bug in IE
  return uri.replace(":80/", "/")
}


var PATHS_RE = /^([^/:]+)(\/.+)$/
var VARS_RE = /{([^{]+)}/g

/**
 * 下面几个方法主要是为了解析configData而工作的
 * configData用于记录config配置，
 * 具体配置教程可访问该连接：https://github.com/seajs/seajs/issues/262
 */

/**
 * 解析别名 - configData 解析
 * 如定义别名 alias: { 'jquery': 'jquery/1.7.2/jquery-debug.js' }
 * parseAlias('jquery') 返回 'jquery/1.7.2/jquery-debug.js'
 */
function parseAlias(id) {
  var alias = configData.alias
  return alias && isString(alias[id]) ? alias[id] : id
}

/**
 * 解析快捷路径 - configData 解析
 * 如定义快捷路径 paths: { 'gallery': 'https://a.alipayobjects.com/gallery' }
 * parsePaths('gallery') 返回 'https://a.alipayobjects.com/gallery'
 */
function parsePaths(id) {
  var paths = configData.paths
  var m

  if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
    id = paths[m[1]] + m[2]
  }

  return id
}

/**
 * 解析变量 - configData 解析
 * 如定义变量 vars: { 'locale': 'zh-cn' }
 * parseVars('locale') 返回 'zh-cn'
 */
function parseVars(id) {
  var vars = configData.vars

  if (vars && id.indexOf("{") > -1) {
    id = id.replace(VARS_RE, function(m, key) {
      return isString(vars[key]) ? vars[key] : m
    })
  }

  return id
}

/**
 * 解析映射 - configData 解析
 * 如定义映射 map: [ ['http://example.com/js/app/', 'http://localhost/js/app/'] ]
 * parseMap('http://example.com/js/app/') 返回 'http://localhost/js/app/'
 */
function parseMap(uri) {
  var map = configData.map
  var ret = uri

  if (map) {
    for (var i = 0; i < map.length; i++) {
      var rule = map[i]

      ret = isFunction(rule) ?
          (rule(uri) || uri) :
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule
      if (ret !== uri) break
    }
  }

  return ret
}


var ABSOLUTE_RE = /^\/\/.|:\//
var RELATIVE_RE = /^\./
var ROOT_RE = /^\//

/**
 * 判断是否绝对路径
 * 判断方式为带有 //: 则为绝对路径
 * 如：file://a.txt | http://a.com 都为绝对路径
 */
function isAbsolute(id) {
  return ABSOLUTE_RE.test(id)
}

/**
 * 判断是否为相对路径
 * 判断方式为字符串以 . 开头
 * 如：./a.txt | .a.txt 都为相对路径
 */
function isRelative(id) {
  return RELATIVE_RE.test(id)
}

/**
 * 判断是否为跟路径
 * 判断方式为字符串以 / 开头
 * 如：/a.txt 则为跟路径
 */
function isRoot(id) {
  return ROOT_RE.test(id)
}


var ROOT_DIR_RE = /^.*?\/\/.*?\//

//TODO 貌似跟python里的os.path.join一样
function addBase(id, refUri) {
  var ret

  if (isAbsolute(id)) {
    ret = id
  }
  else if (isRelative(id)) {
    ret = dirname(refUri || cwd) + id
  }
  else if (isRoot(id)) {
    ret = (cwd.match(ROOT_DIR_RE) || ["/"])[0] + id.substring(1)
  }
  // top-level id
  else {
    ret = configData.base + id
  }

  return ret
}

/**
 * 通过id返回uri
 */
function id2Uri(id, refUri) {
  if (!id) return ""

  id = parseAlias(id)
  id = parsePaths(id)
  id = parseVars(id)
  id = addBase(id, refUri)
  id = normalize(id)
  id = parseMap(id)

  return id
}


/**
 * 设置别名方便压缩
 */
var doc = document
var loc = location
var cwd = dirname(loc.href)
var scripts = doc.getElementsByTagName("script")

/**
 * 推荐为调用seajs的script标签添加值为seajsnode的id
 * 如果没有添加这个id，请务必确保调用seajs的script位于所有script标签的最底部，
 * 既没有添加id的查找方法为返回最后以个script标签来解析data-config和data-main
 */
// Recommend to add `seajs-node` id for the `sea.js` script element
var loaderScript = doc.getElementById("seajsnode") ||
    scripts[scripts.length - 1]

/**
 * 设置loaderDir为seajs的同级目录
 * <script src="js/sea-debug.js" data-config="config"></script>
 * 上面标签的config则直接调用js目录下的config.js文件
 * 如果seajs是内嵌与html中，则返回该html的同级路径
 */
// When `sea.js` is inline, set loaderDir to current working directory
var loaderDir = dirname(getScriptAbsoluteSrc(loaderScript) || cwd)

/**
 * 取seajs的绝对路径
 * 返回值可能是 file:///X:/Users/xxx/project/js/sea.js
 */
function getScriptAbsoluteSrc(node) {
  return node.hasAttribute ? // non-IE6/7
      node.src :
    // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
      node.getAttribute("src", 4)
}

/**
 * 获取或者设置seajs的工作目录
 * 传递值则设置，否则则返回当前seajs的工作路径
 */
// Get/set current working directory
seajs.cwd = function(val) {
  return val ? (cwd = realpath(val + "/")) : cwd
}

/**
 * 设置seajs的同级目录
 */
seajs.dir = loaderDir


/**
 * util-request.js - The utilities for requesting script and style files
 * ref: tests/research/load-js-css/test.html
 */

var head = doc.getElementsByTagName("head")[0] || doc.documentElement
var baseElement = head.getElementsByTagName("base")[0]

var IS_CSS_RE = /\.css(?:\?|$)/i
var READY_STATE_RE = /^(?:loaded|complete|undefined)$/

var currentlyAddingScript
var interactiveScript

// `onload` event is supported in WebKit < 535.23 and Firefox < 9.0
// ref:
//  - https://bugs.webkit.org/show_activity.cgi?id=38995
//  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
//  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
var isOldWebKit = (navigator.userAgent
    .replace(/.*AppleWebKit\/(\d+)\..*/, "$1")) * 1 < 536

/**
 * 请求一个url
 * 请求类型可以是css或js
 * 可指定请求完毕后执行的方法
 */
function request(url, callback, charset) {
  var isCSS = IS_CSS_RE.test(url)
  var node = doc.createElement(isCSS ? "link" : "script")

  if (charset) {
    var cs = isFunction(charset) ? charset(url) : charset
    if (cs) {
      node.charset = cs
    }
  }

  addOnload(node, callback, isCSS)

  if (isCSS) {
    node.rel = "stylesheet"
    node.href = url
  }
  else {
    node.async = true
    node.src = url
  }

  // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
  // the end of the insert execution, so use `currentlyAddingScript` to
  // hold current node, for deriving url in `define` call
  currentlyAddingScript = node

  // ref: #185 & http://dev.jquery.com/ticket/2709
  baseElement ?
      head.insertBefore(node, baseElement) :
      head.appendChild(node)

  currentlyAddingScript = undefined
}

/**
 * 加载指定的url后，执行回调
 */
function addOnload(node, callback, isCSS) {
  var missingOnload = isCSS && (isOldWebKit || !("onload" in node))

  // for Old WebKit and Old Firefox
  if (missingOnload) {
    setTimeout(function() {
      pollCss(node, callback)
    }, 1) // Begin after node insertion
    return
  }

  node.onload = node.onerror = node.onreadystatechange = function() {
    if (READY_STATE_RE.test(node.readyState)) {

      // Ensure only run once and handle memory leak in IE
      node.onload = node.onerror = node.onreadystatechange = null

      // Remove the script to reduce memory leak
      if (!isCSS && !configData.debug) {
        head.removeChild(node)
      }

      // Dereference the node
      node = undefined

      callback()
    }
  }
}

function pollCss(node, callback) {
  var sheet = node.sheet
  var isLoaded

  // for WebKit < 536
  if (isOldWebKit) {
    if (sheet) {
      isLoaded = true
    }
  }
  // for Firefox < 9.0
  else if (sheet) {
    try {
      if (sheet.cssRules) {
        isLoaded = true
      }
    } catch (ex) {
      // The value of `ex.name` is changed from "NS_ERROR_DOM_SECURITY_ERR"
      // to "SecurityError" since Firefox 13.0. But Firefox is less than 9.0
      // in here, So it is ok to just rely on "NS_ERROR_DOM_SECURITY_ERR"
      if (ex.name === "NS_ERROR_DOM_SECURITY_ERR") {
        isLoaded = true
      }
    }
  }

  setTimeout(function() {
    if (isLoaded) {
      // Place callback here to give time for style rendering
      callback()
    }
    else {
      pollCss(node, callback)
    }
  }, 20)
}

/**
 * 获得即将执行的script方法
 */
function getCurrentScript() {
  if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
  if (interactiveScript && interactiveScript.readyState === "interactive") {
    return interactiveScript
  }

  var scripts = head.getElementsByTagName("script")

  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === "interactive") {
      interactiveScript = script
      return interactiveScript
    }
  }
}


/**
 * util-deps.js - The parser for dependencies
 * ref: tests/research/parse-dependencies/test.html
 */

var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g
var SLASH_RE = /\\\\/g

/**
 * 解析依赖关系
 * function(require, exports, module){
 *     var test = require('test')
 *     module.exports.test = test
 * }
 * 解析require的值，既require('test')
 * 返回require的值，既test，转换城数组[test]
 */
function parseDependencies(code) {
  var ret = []

  code.replace(SLASH_RE, "")
      .replace(REQUIRE_RE, function(m, m1, m2) {
        if (m2) {
          ret.push(m2)
        }
      })

  return ret
}


/**
 * module.js - The core of module loader
 */

var cachedModules = seajs.cache = {}
var anonymousModuleData

var fetchingList = {} //加载中的数组
var fetchedList = {} //已加载完成的数组
var callbackList = {} //回调方法列表
var waitingsList = {} //等待加载的列表

// 1 - The module file is being fetched now
// 2 - The module data has been saved to cachedModules
// 3 - The module and all its dependencies are ready to execute
// 4 - The module is being executed
// 5 - The module is executed and `module.exports` is available
var STATUS_FETCHING = 1
var STATUS_SAVED = 2
var STATUS_LOADED = 3
var STATUS_EXECUTING = 4
var STATUS_EXECUTED = 5

/**
 * 模块定义
 * uri 模块uri
 * dependencies 依赖模块
 * exports 导出的模块名
 * status 模块状态
 */
function Module(uri) {
  this.uri = uri
  this.dependencies = []
  this.exports = null
  this.status = 0
}

function resolve(ids, refUri) {
  if (isArray(ids)) {
    var ret = []
    for (var i = 0; i < ids.length; i++) {
      ret[i] = resolve(ids[i], refUri)
    }
    return ret
  }

  // Emit `resolve` event for plugins such as plugin-text
  var data = { id: ids, refUri: refUri }
  emit("resolve", data)

  return data.uri || id2Uri(data.id, refUri)
}

/**
 * 加载一个模块，并执行回调
 */
function use(uris, callback) {
  isArray(uris) || (uris = [uris])

  load(uris, function() {
    var exports = []

    for (var i = 0; i < uris.length; i++) {
      exports[i] = getExports(cachedModules[uris[i]])
    }

    if (callback) {
      callback.apply(global, exports)
    }
  })
}

/**
 * 加载模块
 */
function load(uris, callback) {
  var unloadedUris = getUnloadedUris(uris)

/**
 * 如果模块已加载完毕，则可直接执行callback
 */
  if (unloadedUris.length === 0) {
    callback()
    return
  }

  // Emit `load` event for plugins such as plugin-combo
  emit("load", unloadedUris)

  var len = unloadedUris.length
  var remain = len

  for (var i = 0; i < len; i++) {
    (function(uri) {
    /**
     * 在load方法一开始的时候调用getUnloadedUris的时候
     * 就已经新建了模块对象并缓存到cachedModules里了
     */
      var mod = cachedModules[uri]

    /**
     * 处理模块依赖
     * 如果有依赖关系，则加载依赖模块进来
     * 被依赖的模块会优先加载进来，确保依赖模块能够正常运行
     * 当然这里会先判断被依赖的模块是否已经被加载过
     * STATUS_SAVED这个标识代表被依赖的模块是否已存在
     */
      if (mod.dependencies.length) {
        loadWaitings(function(circular) {
          mod.status < STATUS_SAVED ? fetch(uri, cb) : cb()
          function cb() {
            done(circular)
          }
        })
      }
      /**
       * 如果被依赖的模块都已经加载完毕
       */
      else {
        mod.status < STATUS_SAVED ?
            fetch(uri, loadWaitings) : done()
      }

      function loadWaitings(cb) {
        cb || (cb = done)

        var waitings = mod.dependencies.length ?
            getUnloadedUris(mod.dependencies) : []

        if (waitings.length === 0) {
          cb()
        }
        // Break circular waiting callbacks
        else if (isCircularWaiting(mod)) {
          printCircularLog(circularStack)
          circularStack.length = 0
          cb(true)
        }
        // Load all unloaded dependencies
        else {
          waitingsList[uri] = waitings
          load(waitings, cb)
        }
      }

      function done(circular) {
        if (!circular && mod.status < STATUS_LOADED) {
          mod.status = STATUS_LOADED
        }

        if (--remain === 0) {
          callback()
        }
      }

    })(unloadedUris[i])
  }
}

/**
 * 请求一个模块到本地
 * 该方法主要为load()方法提供模块的载入
 */
function fetch(uri, callback) {
  cachedModules[uri].status = STATUS_FETCHING

  // Emit `fetch` event for plugins such as plugin-combo
  var data = { uri: uri }
  emit("fetch", data)

  var requestUri = data.requestUri || uri

  if (fetchedList[requestUri]) {
    callback()
    return
  }

  if (fetchingList[requestUri]) {
    callbackList[requestUri].push(callback)
    return
  }

  fetchingList[requestUri] = true
  callbackList[requestUri] = [callback]

  // Emit `request` event for plugins such as plugin-text
  var charset = configData.charset
  emit("request", data = {
    uri: uri,
    requestUri: requestUri,
    callback: onRequested,
    charset: charset
  })

  if (!data.requested) {
    request(data.requestUri, onRequested, charset)
  }

  function onRequested() {
    delete fetchingList[requestUri]
    fetchedList[requestUri] = true

    // Save meta data of anonymous module
    if (anonymousModuleData) {
      save(uri, anonymousModuleData)
      anonymousModuleData = undefined
    }

    // Call callbacks
    var fn, fns = callbackList[requestUri]
    delete callbackList[requestUri]

    while ((fn = fns.shift())) fn()

  }
}

/**
 * 定义模块
 * 用户可指定id,deps,factory
 * 但不建议用户指定id,deps，这两个方法在seajs运行时自动会创建
 * factory方法用户必须指定
 * 既如果用户只指定factory则直接传递一个function给define即可
 * define(function(require, exports, module){})
 */
function define(id, deps, factory) {
  // define(factory)
/**
 * 如果用户只传递一个值给deine
 * 则等于指定了factory
 */
  if (arguments.length === 1) {
    factory = id
    id = undefined
  }

/**
 * 解析依赖关系
 * 如果指定了deps参数则执行
 * 最终deps为一个数组
 */
  // Parse dependencies according to the module factory code
  if (!isArray(deps) && isFunction(factory)) {
    deps = parseDependencies(factory.toString())
  }

/**
 * 合并项
 * id
 * uri 为文件的绝对路径
 * deps 为依赖关系，如存在，则是一个数组
 * factory 为define方法传递的factory方法
 */
  var data = { id: id, uri: resolve(id), deps: deps, factory: factory }

  // Try to derive uri in IE6-9 for anonymous modules
  if (!data.uri && doc.attachEvent) {
    var script = getCurrentScript()

    if (script) {
      data.uri = script.src
    }
    else {
      log("Failed to derive: " + factory)

      // NOTE: If the id-deriving methods above is failed, then falls back
      // to use onload event to get the uri
    }
  }

/**
 * 触发缓存堆里的define事件，传递参数为data
 */
  // Emit `define` event, used in plugin-nocache, seajs node version etc
  emit("define", data)

/**
 * 保存到模块缓存堆
 */
  data.uri ? save(data.uri, data) :
      // Save information for "saving" work in the script onload event
      anonymousModuleData = data
}

/**
 * 保存到模块缓存堆里
 */
function save(uri, meta) {
  var mod = getModule(uri)

  // Do NOT override already saved modules
  if (mod.status < STATUS_SAVED) {
    // Let the id of anonymous module equal to its uri
    mod.id = meta.id || uri

    mod.dependencies = resolve(meta.deps || [], uri)
    mod.factory = meta.factory

    if (mod.factory !== undefined) {
      mod.status = STATUS_SAVED
    }
  }
}

/**
 * 执行模块
 * 通过执行exec来最终执行模块方法
 */
function exec(mod) {
  // Return `null` when `mod` is invalid
  if (!mod) {
    return null
  }

  // When module is executed, DO NOT execute it again. When module
  // is being executed, just return `module.exports` too, for avoiding
  // circularly calling
  if (mod.status >= STATUS_EXECUTING) {
    return mod.exports
  }

  mod.status = STATUS_EXECUTING


  function resolveInThisContext(id) {
    return resolve(id, mod.uri)
  }

  function require(id) {
    return getExports(cachedModules[resolveInThisContext(id)])
  }

  require.resolve = resolveInThisContext

  require.async = function(ids, callback) {
    use(resolveInThisContext(ids), callback)
    return require
  }


  var factory = mod.factory

  var exports = isFunction(factory) ?
      factory(require, mod.exports = {}, mod) :
      factory

  mod.exports = exports === undefined ? mod.exports : exports
  mod.status = STATUS_EXECUTED

  return mod.exports
}

Module.prototype.destroy = function() {
  delete cachedModules[this.uri]
  delete fetchedList[this.uri]
}


// Helpers
/**
 * 从模块缓存堆里返回指定的模块
 * 如果指定的模块不存在模块缓存堆里，则新建一个模块
 * 模块属性：
 * Module { uri: 'uri', dependencies: [], exports: null, status: 0 }
 */
function getModule(uri) {
  return cachedModules[uri] ||
      (cachedModules[uri] = new Module(uri))
}

/**
 * 获取为载入的模块
 * 返回数组
 */
function getUnloadedUris(uris) {
  var ret = []

  for (var i = 0; i < uris.length; i++) {
    var uri = uris[i]
  /**
   * STATUS_LOADED = 3
   * STATUS_SAVED = 2
   * STATUS_FETCHING = 1
   */
    if (uri && getModule(uri).status < STATUS_LOADED) {
      ret.push(uri)
    }
  }

  return ret
}

/**
 * 获取模块的导出的变量
 */
function getExports(mod) {
  var exports = exec(mod)
  if (exports === null && (!mod || !IS_CSS_RE.test(mod.uri))) {
    emit("error", mod)
  }
  return exports
}

var circularStack = []

function isCircularWaiting(mod) {
  var waitings = waitingsList[mod.uri] || []
  if (waitings.length === 0) {
    return false
  }

  circularStack.push(mod.uri)
  if (isOverlap(waitings, circularStack)) {
    cutWaitings(waitings)
    return true
  }

  for (var i = 0; i < waitings.length; i++) {
    if (isCircularWaiting(cachedModules[waitings[i]])) {
      return true
    }
  }

  circularStack.pop()
  return false
}

function isOverlap(arrA, arrB) {
  for (var i = 0; i < arrA.length; i++) {
    for (var j = 0; j < arrB.length; j++) {
      if (arrB[j] === arrA[i]) {
        return true
      }
    }
  }
  return false
}

function cutWaitings(waitings) {
  var uri = circularStack[0]

  for (var i = waitings.length - 1; i >= 0; i--) {
    if (waitings[i] === uri) {
      waitings.splice(i, 1)
      break
    }
  }
}

function printCircularLog(stack) {
  stack.push(stack[0])
  log("Circular dependencies: " + stack.join(" -> "))
}

/**
 * 预加载方法
 * 该方法不会自动执行
 * 通过use方法后，才会执行该方法
 * 执行该方法自动会把configData.preload的预加载列表里的方法都执行一次
 */
function preload(callback) {
  var preloadMods = configData.preload
  var len = preloadMods.length

  if (len) {
    use(resolve(preloadMods), function() {
      // Remove the loaded preload modules
      preloadMods.splice(0, len)

      // Allow preload modules to add new preload modules
      preload(callback)
    })
  }
  else {
    callback()
  }
}


// Public API
/**
 * seajs程序入口
 * 通过data-main方法执行，也可直接在页面里写seajs.use(id, callback)来执行
 * 该方法会触发preload方法，preload优先执行configData.preload里的方法，然后
 * 才会执行用户通过use()方法调用的方法
 */
seajs.use = function(ids, callback) {
  // Load preload modules before all other modules
  preload(function() {
    use(resolve(ids), callback)
  })
  return seajs
}

Module.load = use
seajs.resolve = id2Uri
global.define = define

seajs.require = function(id) {
  return (cachedModules[id2Uri(id)] || {}).exports
}


/**
 * config.js - The configuration for the loader
 */
/**
 * seajs配置项
 */
var configData = config.data = {
  // The root path to use for id2uri parsing
  base: (function() {
    var ret = loaderDir

    // If loaderUri is `http://test.com/libs/seajs/[seajs/1.2.3/]sea.js`, the
    // baseUri should be `http://test.com/libs/`
    var m = ret.match(/^(.+?\/)(?:seajs\/)+(?:\d[^/]+\/)?$/)
    if (m) {
      ret = m[1]
    }

    return ret
  })(),

  // The charset for requesting files
  charset: "utf-8",

  // Modules that are needed to load before all other modules
  preload: []

  // debug - Debug mode. The default value is false
  // alias - An object containing shorthands of module id
  // paths - An object containing path shorthands in module id
  // vars - The {xxx} variables in module id
  // map - An array containing rules to map module uri
  // plugins - An array containing needed plugins
}

/**
 * 更新或添加seajs配置项
 */
function config(data) {
  for (var key in data) {
    var curr = data[key]

    // Convert plugins to preload config
    if (curr && key === "plugins") {
      key = "preload"
      curr = plugin2preload(curr)
    }

    var prev = configData[key]

    // Merge object config such as alias, vars
    if (prev && isObject(prev)) {
      for (var k in curr) {
        prev[k] = curr[k]
      }
    }
    else {
      // Concat array config such as map, preload
      if (isArray(prev)) {
        curr = prev.concat(curr)
      }
      // Make sure that `configData.base` is an absolute directory
      else if (key === "base") {
        curr = normalize(addBase(curr + "/"))
      }

      // Set config
      configData[key] = curr
    }
  }

  emit("config", data)
  return seajs
}

seajs.config = config

/**
 * 插件处理方法
 * 自动把插件插入到preload列队里
 * 插件必须以plugin-开头，
 * 在配置plugins时，直接填写插件名即可，
 * 如果调用shim插件，shim的文件名为：plugin-shim.js
 * 写配置plugins时，只需要填写shim即可
 */
function plugin2preload(arr) {
  var ret = [], name

  while ((name = arr.shift())) {
    ret.push(loaderDir + "plugin-" + name)
  }
  return ret
}


/**
 * bootstrap.js - Initialize the plugins and load the entry module
 */
/**
 * seajs的启动
 */
config({
  // Get initial plugins
  plugins: (function() {
    var ret

    // Convert `seajs-xxx` to `seajs-xxx=1`
    // NOTE: use `seajs-xxx=1` flag in url or cookie to enable `plugin-xxx`
    var str = loc.search.replace(/(seajs-\w+)(&|$)/g, "$1=1$2")

    // Add cookie string
    str += " " + doc.cookie

    // Exclude seajs-xxx=0
    str.replace(/seajs-(\w+)=1/g, function(m, name) {
      (ret || (ret = [])).push(name)
    })

    return ret
  })()
})

/**
 * 解析script标签的data-config参数
 */
var dataConfig = loaderScript.getAttribute("data-config")
/**
 * 解析script标签的data-main参数
 */
var dataMain = loaderScript.getAttribute("data-main")

/**
 * 如果有配置data-config项
 */
// Add data-config to preload modules
if (dataConfig) {
  configData.preload.push(dataConfig)
}

/**
 * 如果有配置data-main项
 */
if (dataMain) {
  seajs.use(dataMain)
}

// Enable to load `sea.js` self asynchronously
if (_seajs && _seajs.args) {
  var methods = ["define", "config", "use"]
  var args = _seajs.args
  for (var g = 0; g < args.length; g += 2) {
    seajs[methods[args[g]]].apply(seajs, args[g + 1])
  }
}

/*
 ;(function(m, o, d, u, l, a, r) {
 if(m[o]) return
 function f(n) { return function() { r.push(n, arguments); return a } }
 m[o] = a = { args: (r = []), config: f(1), use: f(2) }
 m.define = f(0)
 u = d.createElement("script")
 u.id = o + "node"
 u.async = true
 u.src = "path/to/sea.js"
 l = d.getElementsByTagName("head")[0]
 l.appendChild(u)
 })(window, "seajs", document);
 */

})(this);