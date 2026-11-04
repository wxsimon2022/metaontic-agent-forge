var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/connection-defaults.ts
function connectionDefaults(values) {
  const text = (key, fallback) => String(values[key] ?? "").trim() || fallback;
  const volc = values.connectionMode === "volcengine";
  return {
    ...volc ? { baseUrl: "https://ark.cn-beijing.volces.com" } : { baseUrl: text("baseUrl", METAONTIC_BASE_URL).replace(/\/+$/, "") },
    submitPath: volc ? "/api/v3/contents/generations/tasks" : text("submitPath", "/doubao/api/v3/contents/generations/tasks"),
    queryPath: volc ? "/api/v3/contents/generations/tasks/{task_id}" : text("queryPath", "/doubao/api/v3/contents/generations/tasks/{task_id}"),
    model: text("model", "doubao-seedance-2-0-mini-260615"),
    imageModel: text("imageModel", "doubao-seedream-5-0-260128"),
    imageUseVideoKey: values.imageUseVideoKey !== false
  };
}
var METAONTIC_BASE_URL;
var init_connection_defaults = __esm({
  "src/connection-defaults.ts"() {
    METAONTIC_BASE_URL = "https://ai.bileego.com";
  }
});

// node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object2, filter) {
  return Object.fromEntries(Object.entries(object2).filter(([key, value]) => filter(key, value)));
}
function mapValues(object2, transform) {
  return Object.fromEntries(Object.entries(object2).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
  return result;
}
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
  if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
  } finally {
    ancestors.delete(value);
  }
}
function createVolatile(value) {
  let current = snapshot(value);
  return Object.freeze({
    get: () => current,
    [write]: (value2) => {
      current = value2;
    }
  });
}
function isVolatile(value) {
  return typeof value === "object" && value !== null && write in value;
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  const ancestors = /* @__PURE__ */ new Set();
  function compare(a2, b2) {
    if (a2 === b2) return true;
    if (isVolatile(a2) || isVolatile(b2)) return isVolatile(a2) && isVolatile(b2);
    if (!strict && isNullable(a2) && isNullable(b2)) return true;
    if (typeof a2 !== typeof b2 || typeof a2 !== "object" || !a2 || !b2) return false;
    if (ancestors.has(a2)) return false;
    function check(test, then) {
      return test(a2) ? test(b2) ? then(a2, b2) : false : test(b2) ? false : void 0;
    }
    ancestors.add(a2);
    try {
      return check(Array.isArray, (a3, b3) => {
        if (a3.length !== b3.length) return false;
        for (let index = 0; index < a3.length; index++) if (!compare(a3[index], b3[index])) return false;
        return true;
      }) ?? check(is("Date"), (a3, b3) => a3.valueOf() === b3.valueOf()) ?? check(is("URL"), (a3, b3) => a3.href === b3.href) ?? check(is("RegExp"), (a3, b3) => a3.source === b3.source && a3.flags === b3.flags) ?? check(isArrayBufferLike, (a3, b3) => {
        if (a3.byteLength !== b3.byteLength) return false;
        const viewA = new Uint8Array(a3);
        const viewB = new Uint8Array(b3);
        for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
        return true;
      }) ?? ((!strict || [a2, b2].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
        ...a2,
        ...b2
      }).every((key) => compare(a2[key], b2[key])));
    } finally {
      ancestors.delete(a2);
    }
  }
  return compare(a, b);
}
var write, Binary, base64ToArrayBuffer, arrayBufferToBase64, hexToArrayBuffer, arrayBufferToHex, Time;
var init_lib = __esm({
  "node_modules/@deepseek-ai/cosmokit/lib/index.js"() {
    write = /* @__PURE__ */ Symbol.for("cosmokit.volatile.write");
    (function(Binary2) {
      Binary2.is = isArrayBufferLike;
      Binary2.isSource = isArrayBufferSource;
      function fromSource(source) {
        if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        else return source;
      }
      Binary2.fromSource = fromSource;
      function toBase64(source) {
        source = fromSource(source);
        if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
        let binary = "";
        const bytes = new Uint8Array(source);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      }
      Binary2.toBase64 = toBase64;
      function fromBase64(source) {
        if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
        return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
      }
      Binary2.fromBase64 = fromBase64;
      function toHex(source) {
        source = fromSource(source);
        if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
        return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
      }
      Binary2.toHex = toHex;
      function fromHex(source) {
        if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
        const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
        const buffer = [];
        for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
        return Uint8Array.from(buffer).buffer;
      }
      Binary2.fromHex = fromHex;
    })(Binary || (Binary = {}));
    base64ToArrayBuffer = Binary.fromBase64;
    arrayBufferToBase64 = Binary.toBase64;
    hexToArrayBuffer = Binary.fromHex;
    arrayBufferToHex = Binary.toHex;
    (function(Time2) {
      Time2.millisecond = 1;
      Time2.second = 1e3;
      Time2.minute = Time2.second * 60;
      Time2.hour = Time2.minute * 60;
      Time2.day = Time2.hour * 24;
      Time2.week = Time2.day * 7;
      let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
      function setTimezoneOffset(offset) {
        timezoneOffset = offset;
      }
      Time2.setTimezoneOffset = setTimezoneOffset;
      function getTimezoneOffset() {
        return timezoneOffset;
      }
      Time2.getTimezoneOffset = getTimezoneOffset;
      function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
        if (typeof date2 === "number") date2 = new Date(date2);
        if (offset === void 0) offset = timezoneOffset;
        return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
      }
      Time2.getDateNumber = getDateNumber;
      function fromDateNumber(value, offset) {
        const date2 = new Date(value * Time2.day);
        if (offset === void 0) offset = timezoneOffset;
        return new Date(+date2 + offset * Time2.minute);
      }
      Time2.fromDateNumber = fromDateNumber;
      const numeric = /\d+(?:\.\d+)?/.source;
      const timeRegExp = new RegExp(`^${[
        "w(?:eek(?:s)?)?",
        "d(?:ay(?:s)?)?",
        "h(?:our(?:s)?)?",
        "m(?:in(?:ute)?(?:s)?)?",
        "s(?:ec(?:ond)?(?:s)?)?"
      ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
      function parseTime(source) {
        const capture = timeRegExp.exec(source);
        if (!capture) return 0;
        return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
      }
      Time2.parseTime = parseTime;
      function parseDate(date2) {
        const parsed = parseTime(date2);
        if (parsed) date2 = Date.now() + parsed;
        else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
        else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
        return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
      }
      Time2.parseDate = parseDate;
      function format(ms) {
        const abs = Math.abs(ms);
        if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
        else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
        else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
        else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
        return ms + "ms";
      }
      Time2.format = format;
      function toDigits(source, length = 2) {
        return source.toString().padStart(length, "0");
      }
      Time2.toDigits = toDigits;
      function template(template2, time = /* @__PURE__ */ new Date()) {
        return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
      }
      Time2.template = template;
    })(Time || (Time = {}));
  }
});

// node_modules/@deepseek-ai/schemastery/lib/index.mjs
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
function validateVolatileSchema(schema, path14 = [], blocked2 = false, seen = /* @__PURE__ */ new Map()) {
  const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
  if (states.has(blocked2)) return;
  states.add(blocked2);
  seen.set(schema, states);
  if (schema.meta?.volatile && blocked2) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path: path14 });
  const nested = blocked2 || !!schema.meta?.volatile;
  if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path14, key], nested, seen);
  if (schema.sKey) validateVolatileSchema(schema.sKey, [...path14, "<key>"], true, seen);
  if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path14, "*"], true, seen);
  if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path14, String(index)], true, seen);
}
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
  }
}
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
function defineMethod(name, keys, format) {
  formatters[name] = format;
  Object.assign(Schema, { [name](...args) {
    const schema = new Schema({ type: name });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name === "object" || name === "dict") schema.meta.default = {};
    else if (name === "array" || name === "tuple") schema.meta.default = [];
    else if (name === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
var kSchema, kValidationError, ValidationError, Schema, resolvers, checkedVolatile, formatters;
var init_lib2 = __esm({
  "node_modules/@deepseek-ai/schemastery/lib/index.mjs"() {
    init_lib();
    kSchema = /* @__PURE__ */ Symbol.for("schemastery");
    kValidationError = /* @__PURE__ */ Symbol.for("ValidationError");
    globalThis.__schemastery_index__ ??= 0;
    globalThis.__schemastery_refs__ = void 0;
    ValidationError = class extends TypeError {
      options;
      name = "ValidationError";
      constructor(message, options) {
        let prefix = "$";
        for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
        else if (typeof segment === "number") prefix += "[" + segment + "]";
        else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
        if (prefix.startsWith(".")) prefix = prefix.slice(1);
        super((prefix === "$" ? "" : `${prefix} `) + message);
        this.options = options;
      }
      static is(error) {
        return !!error?.[kValidationError];
      }
    };
    Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
    Schema = function(options) {
      const schema = function(data, options2 = {}) {
        return Schema.resolve(data, schema, options2)[0];
      };
      if (options.refs) {
        const refs = mapValues(options.refs, (options2) => new Schema(options2));
        const getRef = (uid) => refs[uid];
        for (const key in refs) {
          const options2 = refs[key];
          options2.sKey = getRef(options2.sKey);
          options2.inner = getRef(options2.inner);
          options2.list = options2.list && options2.list.map(getRef);
          options2.dict = options2.dict && mapValues(options2.dict, getRef);
        }
        return refs[options.uid];
      }
      Object.assign(schema, options);
      if (typeof schema.callback === "string") try {
        schema.callback = new Function("return " + schema.callback)();
      } catch {
      }
      Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
      Object.setPrototypeOf(schema, Schema.prototype);
      schema.meta ||= {};
      schema.toString = schema.toString.bind(schema);
      return schema;
    };
    Schema.prototype = Object.create(Function.prototype);
    Schema.prototype[kSchema] = true;
    Object.defineProperty(Schema.prototype, "~standard", { get() {
      return {
        version: 1,
        vendor: "schemastery",
        validate: (value) => {
          try {
            return { value: Schema.resolve(value, this, {})[0] };
          } catch (error) {
            if (ValidationError.is(error)) return { issues: [{
              message: error.message,
              path: error.options.path
            }] };
            throw error;
          }
        }
      };
    } });
    Schema.ValidationError = ValidationError;
    Schema.prototype.toJSON = function toJSON() {
      if (globalThis.__schemastery_refs__) {
        globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
        return this.uid;
      }
      globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
      globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
      const result = {
        uid: this.uid,
        refs: globalThis.__schemastery_refs__
      };
      globalThis.__schemastery_refs__ = void 0;
      return result;
    };
    Schema.prototype.set = function set(key, value) {
      this.dict[key] = value;
      return this;
    };
    Schema.prototype.push = function push(value) {
      this.list.push(value);
      return this;
    };
    Schema.prototype.i18n = function i18n(messages) {
      const schema = Schema(this);
      const desc = mergeDesc(schema.meta.description, messages);
      if (Object.keys(desc).length) schema.meta.description = desc;
      if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
        return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
      });
      if (schema.list) schema.list = schema.list.map((inner, index) => {
        return inner.i18n(mapValues(messages, (data = {}) => {
          if (Array.isArray(getInner(data))) return getInner(data)[index];
          if (Array.isArray(data)) return data[index];
          return extractKeys(data);
        }));
      });
      if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
        if (getInner(data)) return getInner(data);
        return extractKeys(data);
      }));
      if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
      return schema;
    };
    Schema.prototype.extra = function extra(key, value) {
      const schema = Schema(this);
      schema.meta = {
        ...schema.meta,
        [key]: value
      };
      return schema;
    };
    for (const key of [
      "required",
      "disabled",
      "collapse",
      "hidden",
      "loose"
    ]) Object.assign(Schema.prototype, { [key](value = true) {
      const schema = Schema(this);
      schema.meta = {
        ...schema.meta,
        [key]: value
      };
      return schema;
    } });
    Schema.prototype.deprecated = function deprecated() {
      const schema = Schema(this);
      schema.meta.badges ||= [];
      schema.meta.badges.push({
        text: "deprecated",
        type: "danger"
      });
      return schema;
    };
    Schema.prototype.experimental = function experimental() {
      const schema = Schema(this);
      schema.meta.badges ||= [];
      schema.meta.badges.push({
        text: "experimental",
        type: "warning"
      });
      return schema;
    };
    Schema.prototype.pattern = function pattern(regexp) {
      const schema = Schema(this);
      const pattern2 = pick(regexp, ["source", "flags"]);
      schema.meta = {
        ...schema.meta,
        pattern: pattern2
      };
      return schema;
    };
    Schema.prototype.simplify = function simplify(value) {
      if (isVolatile(value)) value = value.get();
      if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
      if (isNullable(value)) return value;
      if (this.type === "object" || this.type === "dict") {
        const result = {};
        for (const key in value) {
          const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
          if (this.type === "dict" || !isNullable(item)) result[key] = item;
        }
        if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
        return result;
      } else if (this.type === "array" || this.type === "tuple") {
        const result = [];
        value.forEach((value2, index) => {
          const schema = this.type === "array" ? this.inner : this.list[index];
          const item = schema ? schema.simplify(value2) : value2;
          result.push(item);
        });
        return result;
      } else if (this.type === "intersect") {
        const result = {};
        for (const item of this.list) Object.assign(result, item.simplify(value));
        return result;
      } else if (this.type === "union") for (const schema of this.list) try {
        Schema.resolve(value, schema, {});
        return schema.simplify(value);
      } catch {
      }
      return value;
    };
    Schema.prototype.toString = function toString(inline) {
      return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
    };
    Schema.prototype.role = function role(role, extra2) {
      const schema = Schema(this);
      schema.meta = {
        ...schema.meta,
        role,
        extra: extra2
      };
      return schema;
    };
    for (const key of [
      "default",
      "link",
      "comment",
      "description",
      "max",
      "min",
      "step"
    ]) Object.assign(Schema.prototype, { [key](value) {
      const schema = Schema(this);
      schema.meta = {
        ...schema.meta,
        [key]: value
      };
      return schema;
    } });
    Schema.prototype.volatile = function volatile() {
      if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
      return this.extra("volatile", true);
    };
    resolvers = {};
    checkedVolatile = /* @__PURE__ */ Symbol("checked-volatile-schema");
    Schema.extend = function extend(type, resolve3) {
      resolvers[type] = resolve3;
    };
    Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
      if (!schema) return [data];
      if (!options[checkedVolatile]) {
        validateVolatileSchema(schema, options.path);
        options = {
          ...options,
          [checkedVolatile]: true
        };
      }
      if (schema.meta?.volatile) {
        const inner = Schema(schema);
        inner.meta = {
          ...schema.meta,
          volatile: false
        };
        const [value, adapted] = Schema.resolve(data, inner, options, strict);
        try {
          return [createVolatile(value), adapted];
        } catch (error) {
          throw new ValidationError(error instanceof Error ? error.message : String(error), options);
        }
      }
      if (options.ignore?.(data, schema)) return [data];
      if (isNullable(data) && schema.type !== "lazy") {
        if (schema.meta.required) throw new ValidationError(`missing required value`, options);
        let current = schema;
        let fallback = schema.meta.default;
        while (current?.type === "intersect" && isNullable(fallback)) {
          current = current.list[0];
          fallback = current?.meta.default;
        }
        if (isNullable(fallback)) return [data];
        data = clone(fallback);
      }
      const callback = resolvers[schema.type];
      if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
      try {
        return callback(data, schema, options, strict);
      } catch (error) {
        if (!schema.meta.loose) throw error;
        return [schema.meta.default];
      }
    };
    Schema.from = function from(source) {
      if (isNullable(source)) return Schema.any();
      else if ([
        "string",
        "number",
        "boolean"
      ].includes(typeof source)) return Schema.const(source).required();
      else if (source[kSchema]) return source;
      else if (typeof source === "function") switch (source) {
        case String:
          return Schema.string().required();
        case Number:
          return Schema.number().required();
        case Boolean:
          return Schema.boolean().required();
        case Function:
          return Schema.function().required();
        default:
          return Schema.is(source).required();
      }
      else throw new TypeError(`cannot infer schema from ${source}`);
    };
    Schema.lazy = function lazy(builder) {
      const toJSON2 = () => {
        if (!schema.inner[kSchema]) {
          schema.inner = schema.builder();
          schema.inner.meta = {
            ...schema.meta,
            ...schema.inner.meta
          };
        }
        return schema.inner.toJSON();
      };
      const schema = new Schema({
        type: "lazy",
        builder,
        inner: { toJSON: toJSON2 }
      });
      return schema;
    };
    Schema.natural = function natural() {
      return Schema.number().step(1).min(0);
    };
    Schema.percent = function percent() {
      return Schema.number().step(0.01).min(0).max(1).role("slider");
    };
    Schema.date = function date() {
      return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
        const date2 = new Date(value);
        if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
        return date2;
      }, true)]);
    };
    Schema.regExp = function regExp(flag = "") {
      return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
        try {
          return new RegExp(value, flag);
        } catch (e) {
          throw new ValidationError(e.message, options);
        }
      }, true)]);
    };
    Schema.arrayBuffer = function arrayBuffer(encoding) {
      return Schema.union([
        Schema.is(ArrayBuffer),
        Schema.is(SharedArrayBuffer),
        Schema.transform(Schema.any(), (value, options) => {
          if (Binary.isSource(value)) return Binary.fromSource(value);
          throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
        }, true),
        ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
          try {
            return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
          } catch (e) {
            throw new ValidationError(e.message, options);
          }
        }, true)] : []
      ]);
    };
    Schema.extend("lazy", (data, schema, options, strict) => {
      if (!schema.inner[kSchema]) {
        schema.inner = schema.builder();
        schema.inner.meta = {
          ...schema.meta,
          ...schema.inner.meta
        };
        validateVolatileSchema(schema.inner, options.path, true);
      }
      return Schema.resolve(data, schema.inner, options, strict);
    });
    Schema.extend("any", (data) => {
      return [data];
    });
    Schema.extend("never", (data, _, options) => {
      throw new ValidationError(`expected nullable but got ${data}`, options);
    });
    Schema.extend("const", (data, { value }, options) => {
      if (deepEqual(data, value)) return [value];
      throw new ValidationError(`expected ${value} but got ${data}`, options);
    });
    Schema.extend("string", (data, { meta }, options) => {
      if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
      if (meta.pattern) {
        const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
        if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
      }
      checkWithinRange(data.length, meta, "string length", options);
      return [data];
    });
    Schema.extend("number", (data, { meta }, options) => {
      if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
      checkWithinRange(data, meta, "number", options);
      const { step } = meta;
      if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
      return [data];
    });
    Schema.extend("boolean", (data, _, options) => {
      if (typeof data === "boolean") return [data];
      throw new ValidationError(`expected boolean but got ${data}`, options);
    });
    Schema.extend("bitset", (data, { bits, meta }, options) => {
      let value = 0, keys = [];
      if (typeof data === "number") {
        value = data;
        for (const key in bits) if (data & bits[key]) keys.push(key);
      } else if (Array.isArray(data)) {
        keys = data;
        for (const key of keys) {
          if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
          if (key in bits) value |= bits[key];
        }
      } else throw new ValidationError(`expected number or array but got ${data}`, options);
      if (value === meta.default) return [value];
      return [value, keys];
    });
    Schema.extend("function", (data, _, options) => {
      if (typeof data === "function") return [data];
      throw new ValidationError(`expected function but got ${data}`, options);
    });
    Schema.extend("is", (data, { constructor }, options) => {
      if (typeof constructor === "function") {
        if (data instanceof constructor) return [data];
        throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
      } else {
        if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
        let prototype = Object.getPrototypeOf(data);
        while (prototype) {
          if (prototype.constructor?.name === constructor) return [data];
          prototype = Object.getPrototypeOf(prototype);
        }
        throw new ValidationError(`expected ${constructor} but got ${data}`, options);
      }
    });
    Schema.extend("array", (data, { inner, meta }, options) => {
      if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
      checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
      return [data.map((_, index) => property(data, index, inner, options))];
    });
    Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
      if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
      const result = {};
      for (const key in data) {
        let rKey;
        try {
          rKey = Schema.resolve(key, sKey, options)[0];
        } catch (error) {
          if (strict) continue;
          throw error;
        }
        result[rKey] = property(data, key, inner, options);
        data[rKey] = data[key];
        if (key !== rKey) delete data[key];
      }
      return [result];
    });
    Schema.extend("tuple", (data, { list }, options, strict) => {
      if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
      const result = list.map((inner, index) => property(data, index, inner, options));
      if (strict) return [result];
      result.push(...data.slice(list.length));
      return [result];
    });
    Schema.extend("object", (data, { dict }, options, strict) => {
      if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
      const result = {};
      for (const key in dict) {
        const value = property(data, key, dict[key], options);
        if (!isNullable(value) || key in data) result[key] = value;
      }
      if (!strict) merge(result, data);
      return [result];
    });
    Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
      const messages = [];
      for (const inner of list) try {
        return Schema.resolve(data, inner, options, strict);
      } catch (error) {
        messages.push(error);
      }
      throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    });
    Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
      if (!list.length) return [data];
      let result;
      for (const inner of list) {
        const value = Schema.resolve(data, inner, options, true)[0];
        if (isNullable(value)) continue;
        if (isNullable(result)) result = value;
        else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
        else if (typeof value === "object") merge(result ??= {}, value);
        else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
      }
      if (!strict && isPlainObject(data)) merge(result, data);
      return [result];
    });
    Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
      const [result, adapted = data] = Schema.resolve(data, inner, options, true);
      if (preserve) return [callback(result)];
      else return [callback(result), callback(adapted)];
    });
    formatters = {};
    defineMethod("is", ["constructor"], ({ constructor }) => {
      if (typeof constructor === "function") return constructor.name;
      else return constructor;
    });
    defineMethod("any", [], () => "any");
    defineMethod("never", [], () => "never");
    defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
    defineMethod("string", [], () => "string");
    defineMethod("number", [], () => "number");
    defineMethod("boolean", [], () => "boolean");
    defineMethod("bitset", ["bits"], () => "bitset");
    defineMethod("function", [], () => "function");
    defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
    defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
    defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
    defineMethod("object", ["dict"], ({ dict }) => {
      if (Object.keys(dict).length === 0) return "{}";
      return `{ ${Object.entries(dict).map(([key, inner]) => {
        return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
      }).join(", ")} }`;
    });
    defineMethod("union", ["list"], ({ list }, inline) => {
      const result = list.map(({ toString: format }) => format()).join(" | ");
      return inline ? `(${result})` : result;
    });
    defineMethod("intersect", ["list"], ({ list }) => {
      return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
    });
    defineMethod("transform", [
      "inner",
      "callback",
      "preserve"
    ], ({ inner }, isInner) => inner.toString(isInner));
  }
});

// src/config.ts
function resolveResolution(config, args = {}) {
  const resolution = String(args?.resolution ?? FIXED_RESOLUTION).toLowerCase();
  if (!["480p", "720p"].includes(resolution)) throw new Error("\u89C6\u9891\u6E05\u6670\u5EA6\u4EC5\u652F\u6301 480P \u6216 720P\u3002");
  return resolution;
}
function ref(config, key, fallback) {
  const raw = config?.[key];
  const value = raw && typeof raw.get === "function" ? raw.get() : raw;
  return value === void 0 || value === null || value === "" ? fallback : value;
}
function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
var Config, DEFAULT_MODEL, MAX_SEGMENTS, MIN_SECONDS, MIN_SEGMENT_SECONDS, MAX_SEGMENT_SECONDS, MAX_TOTAL_SECONDS, FIXED_RESOLUTION, DEFAULT_OUTPUT_DIR, CUMULATIVE_TOLERANCE_RATIO, CUMULATIVE_TOLERANCE_MIN_SECONDS, DEFAULT_REGISTER_API, DEFAULT_REGISTER_TOKEN, KEY_ORIGIN_REGISTER, DEFAULT_QUOTA_PER_UNIT, DEFAULT_USD_EXCHANGE_RATE, GATED_TOOLS, ESTIMATE_PIXELS, ESTIMATE_FPS, ESTIMATE_TOKEN_DIVISOR, ESTIMATE_RATES, RELAY_PRESET, SUCCESS_STATES, FAILED_STATES, CANCEL_STATES, QUOTA_HINTS, PRICE_HINTS, CONTENT_HINTS, VIDEO_URL_KEYS, GENERIC_URL_KEYS, IMAGE_KEY_TOKENS, IMAGE_EXTENSIONS, CONTINUOUS_TRANSITION, FORWARD_TRANSITION, CLOSEUP_TRANSITION, CONTENT_REJECTION_HINT, PLUGIN_VERSION;
var init_config = __esm({
  "src/config.ts"() {
    init_connection_defaults();
    init_lib2();
    Config = Schema.object({
      connectionMode: Schema.union(["service", "metaontic", "volcengine"]).default("service").description("\u63A5\u5165\u65B9\u5F0F\uFF1AA \u670D\u52A1\u7AEF\u9886 Key\uFF1BB MetaOntic AI\uFF1BC \u706B\u5C71\u5F15\u64CE\u76F4\u8FDE").volatile(),
      metaonticApiKey: Schema.string().default("").description("MetaOntic AI API Key").volatile(),
      volcengineApiKey: Schema.string().default("").description("C \u6A21\u5F0F\u706B\u5C71\u5F15\u64CE API Key").volatile(),
      entryId: Schema.string().default("metaontic-video").description("\u672C\u63D2\u4EF6\u5728 profile patch \u91CC\u7684\u6761\u76EE id\uFF1B\u914D\u7F6E\u5DE5\u5177\u7528\u5B83\u628A\u6539\u52A8\u5199\u56DE").volatile(),
      apiKey: Schema.string().default("").description(
        "API Key\uFF1A\u53EA\u5728\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D\u65F6\u7531\u670D\u52A1\u7AEF\u4E0B\u53D1\u5E76\u76F4\u63A5\u5199\u8FDB\u914D\u7F6E\uFF0C\u4E0D\u652F\u6301\u624B\u586B\u3001\u4E5F\u4E0D\u8BFB\u73AF\u5883\u53D8\u91CF\uFF1B\u624B\u6539\u8FD9\u91CC\u7684\u503C\u4F1A\u88AB\u62D2\u7EDD\u8C03\u7528"
      ).volatile(),
      keyOrigin: Schema.string().default("").description("\u5BC6\u94A5\u6765\u6E90\u6807\u8BB0\uFF1A\u8BBE\u7F6E\u9875\u300C\u767B\u5F55\u300D\u6210\u529F\u540E\u5199\u5165 'register'\uFF0C\u63D2\u4EF6\u53EA\u8BA4\u670D\u52A1\u7AEF\u4E0B\u53D1\u7684 Key").volatile(),
      baseUrl: Schema.string().default("").description(
        "\u57FA\u7840\u5730\u5740\uFF08\u4E2D\u8F6C\u7AD9\u7AD9\u5740\uFF09\uFF1B\u7559\u7A7A\u65F6\u8BFB\u73AF\u5883\u53D8\u91CF NEWAPI_VIDEO_BASE_URL / NEWAPI_BASE_URL\uFF0C\u518D\u4F7F\u7528 https://ai.bileego.com\u3002\u793A\u4F8B https://ai.bileego.com\uFF08\u4E0D\u8981\u5E26 /v1\uFF0C\u4E5F\u4E0D\u8981\u91CD\u590D /api/v3\uFF09"
      ).volatile(),
      submitPath: Schema.string().default("").description("\u521B\u5EFA\u4EFB\u52A1\u8DEF\u5F84\uFF1B\u7559\u7A7A\u7528\u4E2D\u8F6C\u7AD9\u9ED8\u8BA4\u503C /doubao/api/v3/contents/generations/tasks").volatile(),
      queryPath: Schema.string().default("").description("\u67E5\u8BE2\u4EFB\u52A1\u8DEF\u5F84\uFF0C{task_id} \u4F1A\u88AB\u4EFB\u52A1 ID \u66FF\u6362\uFF1B\u7559\u7A7A\u7528\u4E2D\u8F6C\u7AD9\u9ED8\u8BA4\u503C").volatile(),
      imageUseVideoKey: Schema.boolean().default(true).description("\u56FE\u7247\u6A21\u578B\u4E0E\u89C6\u9891\u6A21\u578B\u5171\u7528 Key").volatile(),
      imageApiKey: Schema.string().default("").description("\u4E0D\u5171\u7528\u65F6\u586B\u5199\u7684\u56FE\u7247\u6A21\u578B API Key").volatile(),
      imageModel: Schema.union(["doubao-seedream-5-0-260128", "doubao-seedream-5-0-pro-260628"]).default("doubao-seedream-5-0-260128").description("A/B \u771F\u4EBA\u53C2\u8003\u56FE\u975E\u771F\u4EBA\u5316\u4F7F\u7528\u7684\u56FE\u7247\u6A21\u578B").volatile(),
      model: Schema.string().default("").description("\u89C6\u9891\u751F\u6210\u7528\u7684\u6A21\u578B ID\uFF08seedance 2.0 / 2.5 \u7CFB\u5217\uFF09\uFF1B\u7559\u7A7A\u8BFB NEWAPI_VIDEO_MODEL \u6216\u5185\u7F6E\u9ED8\u8BA4\u503C").volatile(),
      registerEmail: Schema.string().default("").description("\u9886 Key \u7528\u7684\u90AE\u7BB1\uFF08\u8D26\u53F7\uFF09\uFF1A\u4E2D\u8F6C\u7AD9\u91CC\u7684\u5BC6\u94A5\u540D\u7531\u670D\u52A1\u7AEF\u751F\u6210\u552F\u4E00\u4E32\uFF0C\u4E0E\u8FD9\u4E2A\u90AE\u7BB1\u7ED1\u5B9A").volatile(),
      registerToken: Schema.string().default("metaontic-video-register-v1").description("\u6CE8\u518C\u8BF7\u6C42\u5934 X-Register-Token \u7684\u503C\uFF0C\u8981\u4E0E\u670D\u52A1\u7AEF REGISTER_CLIENT_TOKEN \u4E00\u81F4\uFF1B\u9875\u9762\u4E0D\u663E\u793A").volatile(),
      registerApi: Schema.string().default("").description("\u63D2\u4EF6\u670D\u52A1\u5730\u5740\uFF08\u9886 Key / \u67E5\u989D\u5EA6 / \u4F7F\u7528\u8BB0\u5F55\uFF09\uFF1B\u7559\u7A7A\u7528\u5185\u7F6E\u7684\u89C6\u9891\u670D\u52A1\u57DF\u540D").volatile(),
      deviceId: Schema.string().default("").description("\u672C\u673A\u8BBE\u5907\u6807\u8BC6\uFF1A\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D\u65F6\u5199\u5165\uFF0C\u7528\u6765\u67E5\u8FD9\u628A Key \u7684\u5269\u4F59\u989D\u5EA6").volatile(),
      deviceSecret: Schema.string().default("").description("\u672C\u673A\u8BBE\u5907\u5BC6\u94A5\uFF1A\u4E0E\u8BBE\u5907\u6807\u8BC6\u4E00\u8D77\u7ED1\u5B9A\u5F52\u5C5E\uFF1B\u9875\u9762\u4E0D\u663E\u793A").volatile(),
      estimateGroupRatio: Schema.number().min(0).max(10).default(0.8).description("\u9884\u4F30\u8D39\u7528\u7528\u7684\u5206\u7EC4\u6298\u6263\uFF08\u4E2D\u8F6C\u7AD9 group_ratio\uFF1Avideosvip=0.8\u3001default=1\uFF09").volatile(),
      duration: Schema.number().step(1).min(4).max(30).default(15).description("\u517C\u5BB9\u65E7\u914D\u7F6E\uFF1B\u5206\u6BB5\u9ED8\u8BA4\u6309\u6A21\u578B\u4E0A\u9650\u6620\u5C04\uFF1A2.0 \u4E3A 15 \u79D2\u30012.5 \u4E3A 30 \u79D2\u3002\u9700\u7F29\u77ED\u5206\u6BB5\u65F6\u5728\u5DE5\u5177\u8C03\u7528\u4E2D\u6307\u5B9A\u3002").volatile(),
      singleMaxSeconds: Schema.number().step(1).min(4).max(30).default(15).description("\u517C\u5BB9\u65E7\u914D\u7F6E\uFF1B\u5355\u6B21\u76F4\u51FA\u4E0A\u9650\u7531\u6A21\u578B\u51B3\u5B9A\uFF1A2.0 \u4E3A 15 \u79D2\u30012.5 \u4E3A 30 \u79D2\u3002").volatile(),
      seamTrimSeconds: Schema.string().default("").description("2.0 \u9ED8\u8BA4\u6BCF\u63A5\u7F1D\u88C1\u524D\u6BB5\u5C3E6\u5E27\u3001\u540E\u6BB5\u59341\u5E27\uFF1B\u586B0\u5173\u95ED\u3002\u8986\u76D6\u4E3A\u624B\u52A8\u88C1\u526A\uFF1A\u9017\u53F7\u5206\u9694\u79D2\u6570\uFF0C\u5BF9\u5E94\u7B2C2\u30013\u2026\u6BB5\u5F00\u5934\uFF0C0\u20133\u79D2\uFF1B2.5\u7559\u7A7A\u4E0D\u88C1\u3002\u5148\u9884\u89C8\u786E\u8BA4\uFF0C\u907F\u514D\u5207\u65AD\u5BF9\u767D\u3002").volatile(),
      mergeMode: Schema.union(["seamless", "copy", "reencode"]).default("copy").description(
        "\u5408\u5E76\u65B9\u5F0F\uFF1Acopy=\u76F4\u63A5\u62FC\u63A5\uFF08\u9ED8\u8BA4\uFF0C\u65E0\u753B\u9762\u53E0\u5316\uFF09\uFF1Breencode=\u7EDF\u4E00\u91CD\u7F16\u7801\u540E\u76F4\u63A5\u62FC\u63A5\uFF1Bseamless\u4E3A\u65E7\u914D\u7F6E\u517C\u5BB9\u503C\uFF0C\u6309\u76F4\u63A5\u62FC\u63A5\u5904\u7406\u3002"
      ).volatile(),
      bgmFadeSeconds: Schema.number().min(0).max(3).default(0.8).description("\u65E7\u914D\u7F6E\u517C\u5BB9\u5B57\u6BB5\uFF0C\u5F53\u524D\u76F4\u63A5\u62FC\u63A5\u4E0D\u4F7F\u7528\u97F3\u9891\u4EA4\u53C9\u6DE1\u5316\uFF0C\u4FEE\u6539\u6B64\u503C\u4E0D\u751F\u6548\u3002").volatile(),
      outputDir: Schema.string().default("").description("\u6210\u7247\u8F93\u51FA\u76EE\u5F55\uFF1B\u7559\u7A7A\u7528\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/").volatile(),
      keepSegments: Schema.boolean().default(true).description("\u65E7\u914D\u7F6E\u517C\u5BB9\u5B57\u6BB5\uFF1B\u539F\u59CB\u5206\u6BB5\u59CB\u7EC8\u4FDD\u7559\uFF0C\u6B64\u503C\u4E0D\u518D\u63A7\u5236\u5220\u9664\u3002").volatile(),
      resumeLockStaleMinutes: Schema.number().min(0).default(60).description(
        "\u6682\u505C\u76EE\u5F55\u7684\u300C\u7EED\u505A\u9501\u300D\u8D85\u8FC7\u591A\u5C11\u5206\u949F\u7B97\u8FC7\u671F\u6B8B\u7559\uFF08\u9ED8\u8BA4 60\uFF0C0=\u6C38\u4E0D\u8FC7\u671F\uFF09\u3002\u540C\u4E00\u4EFD\u6682\u505C\u8FDB\u5EA6\u540C\u65F6\u53EA\u80FD\u6709\u4E00\u6B21 resume \u5728\u8DD1\uFF0C\u5426\u5219\u5269\u4E0B\u7684\u6BB5\u4F1A\u88AB\u63D0\u4EA4\u4E24\u904D\u3001\u91CD\u590D\u6263\u8D39\uFF1B\u4E0A\u4E00\u6B21\u88AB\u5F3A\u6740 / \u5BBF\u4E3B\u653E\u5F03\u8C03\u7528\u65F6\u9501\u6587\u4EF6\u4F1A\u7559\u4E0B\uFF0C\u8D85\u8FC7\u8FD9\u4E2A\u65F6\u95F4\u624D\u5141\u8BB8\u540E\u6765\u8005\u62A2\u8FC7\u6765\u3002"
      ).volatile(),
      ffmpegBinary: Schema.string().default("ffmpeg").description("ffmpeg \u53EF\u6267\u884C\u6587\u4EF6\uFF1BPATH \u91CC\u6CA1\u6709\u65F6\u586B\u7EDD\u5BF9\u8DEF\u5F84").volatile(),
      ffprobeBinary: Schema.string().default("ffprobe").description("ffprobe \u53EF\u6267\u884C\u6587\u4EF6\uFF1BPATH \u91CC\u6CA1\u6709\u65F6\u586B\u7EDD\u5BF9\u8DEF\u5F84").volatile(),
      mode: Schema.union(["continuous", "closeup"]).default("continuous").description("\u65E7\u914D\u7F6E\u517C\u5BB9\u5B57\u6BB5\uFF0C\u65B0\u4EFB\u52A1\u4E0D\u518D\u8BFB\u53D6\uFF1B\u7EED\u62CD\u65B9\u5F0F\u7531\u5DF2\u5BA1\u6838\u811A\u672C\u7684\u5DE5\u5177\u53C2\u6570\u4E0E\u8FC7\u6E21\u63CF\u8FF0\u51B3\u5B9A").volatile(),
      ratio: Schema.union(["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"]).default("adaptive").description("\u753B\u9762\u6BD4\u4F8B\uFF1Bseedance 2.5 \u5EF6\u957F\u65F6\u56FA\u5B9A\u6539\u7528 adaptive").volatile(),
      generateAudio: Schema.boolean().default(true).description("\u662F\u5426\u751F\u6210\u97F3\u9891").volatile(),
      watermark: Schema.boolean().default(false).description("\u662F\u5426\u6DFB\u52A0\u6C34\u5370\uFF1B\u90E8\u5206\u4E2D\u8F6C\u7AD9\u53EA\u63A5\u53D7 true").volatile(),
      extraParams: Schema.string().default("").description("JSON \u5BF9\u8C61\u5B57\u7B26\u4E32\uFF0C\u5408\u5E76\u8FDB\u8BF7\u6C42\u4F53\uFF0C\u7528\u4E8E\u4E2D\u8F6C\u7AD9\u7684\u7279\u6709\u5B57\u6BB5").volatile(),
      pollIntervalMs: Schema.natural().min(1e3).default(5e3).description("\u8F6E\u8BE2\u4EFB\u52A1\u72B6\u6001\u7684\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09").volatile(),
      maxWaitMs: Schema.natural().min(1e3).default(6e5).description("\u5355\u6B21\u8C03\u7528\u6700\u957F\u7B49\u5F85\u65F6\u95F4\uFF08\u6BEB\u79D2\uFF09").volatile(),
      pollErrorRetries: Schema.natural().min(1).max(60).default(5).description(
        "\u8F6E\u8BE2\u671F\u95F4\u300C\u67E5\u8BE2\u5931\u8D25\u300D\u7684\u5BB9\u5FCD\u6B21\u6570\uFF1A\u7F51\u7EDC\u6296\u52A8\u3001\u4E2D\u8F6C\u7AD9\u9650\u6D41\u3001Key \u4E2D\u9014\u88AB\u5224\u65E0\u6548\u90FD\u4F1A\u8BA9\u67E5\u8BE2\u62A5\u9519\uFF0C\u4F46\u4EFB\u52A1\u5728\u4E0A\u6E38\u7167\u5E38\u751F\u6210\u2014\u2014\u8FDE\u7EED\u5931\u8D25\u5230\u8FD9\u4E2A\u6B21\u6570\u624D\u653E\u5F03\u7B49\u5F85\u3002\u653E\u5F03\u65F6\u4EFB\u52A1 ID \u4ECD\u4FDD\u7559\uFF0C\u53EF\u7528 video_status \u4E8B\u540E\u8865\u67E5\uFF0C\u4E0D\u4F1A\u628A\u300C\u67E5\u4E0D\u5230\u300D\u5F53\u6210\u300C\u6CA1\u751F\u6210\u300D\u3002\u8BBE\u7F6E\u9875\u4E0D\u663E\u793A\u8FD9\u4E00\u9879\uFF1A\u9ED8\u8BA4\u503C 5 \u591F\u7528\u3002"
      ).volatile()
    });
    DEFAULT_MODEL = "doubao-seedance-2-0-mini-260615";
    MAX_SEGMENTS = 10;
    MIN_SECONDS = 4;
    MIN_SEGMENT_SECONDS = 4;
    MAX_SEGMENT_SECONDS = 15;
    MAX_TOTAL_SECONDS = 120;
    FIXED_RESOLUTION = "720p";
    DEFAULT_OUTPUT_DIR = "metaontic-video";
    CUMULATIVE_TOLERANCE_RATIO = 0.25;
    CUMULATIVE_TOLERANCE_MIN_SECONDS = 1.5;
    DEFAULT_REGISTER_API = "https://video.mybfs.cn";
    DEFAULT_REGISTER_TOKEN = "metaontic-video-register-v1";
    KEY_ORIGIN_REGISTER = "register";
    DEFAULT_QUOTA_PER_UNIT = 5e5;
    DEFAULT_USD_EXCHANGE_RATE = 7.3;
    GATED_TOOLS = ["video_generate", "video_extend", "video_setup", "video_prepare_image", "media_submission"];
    ESTIMATE_PIXELS = { "480p": [864, 496], "720p": [1280, 720], "1080p": [1920, 1080] };
    ESTIMATE_FPS = 24;
    ESTIMATE_TOKEN_DIVISOR = 1024;
    ESTIMATE_RATES = [
      ["doubao-seedance-2-0-mini", { none: 3.150684931507, video: 1.917808219178 }],
      ["doubao-seedance-2-0-fast", { none: 5.068493150685, video: 3.013698630137 }]
    ];
    RELAY_PRESET = {
      baseUrl: METAONTIC_BASE_URL,
      submitPath: "/doubao/api/v3/contents/generations/tasks",
      queryPath: "/doubao/api/v3/contents/generations/tasks/{task_id}",
      model: DEFAULT_MODEL,
      baseEnv: ["NEWAPI_VIDEO_BASE_URL", "NEWAPI_BASE_URL"],
      modelEnv: ["NEWAPI_VIDEO_MODEL"]
    };
    SUCCESS_STATES = /* @__PURE__ */ new Set(["succeeded", "success", "completed", "complete", "done", "finished"]);
    FAILED_STATES = /* @__PURE__ */ new Set(["failed", "failure", "error", "cancelled", "canceled", "expired"]);
    CANCEL_STATES = /* @__PURE__ */ new Set(["cancelled", "canceled"]);
    QUOTA_HINTS = ["quota", "insufficient", "balance", "\u9884\u6263\u8D39", "\u5269\u4F59\u989D\u5EA6"];
    PRICE_HINTS = ["model_price_error", "\u9636\u68AF\u8BA1\u4EF7", 'u("input_images")'];
    CONTENT_HINTS = [
      "real person",
      "privacyinformation",
      "privacy information",
      "content policy",
      "content_policy",
      "contentpolicy",
      "content safety",
      "safety policy",
      "sensitive",
      "\u8FDD\u89C4",
      "\u654F\u611F",
      "\u6D89\u653F"
    ];
    VIDEO_URL_KEYS = [
      "video_url",
      "videourl",
      "download_url",
      "play_url",
      "result_url",
      "output_url"
    ];
    GENERIC_URL_KEYS = /* @__PURE__ */ new Set(["url", "output", "video", "file"]);
    IMAGE_KEY_TOKENS = ["cover", "image", "thumb", "poster", "frame", "snapshot", "preview"];
    IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];
    CONTINUOUS_TRANSITION = "\u672C\u6BB5\u7B2C\u4E00\u5E27\u5FC5\u987B\u7D27\u63A5\u89C6\u98911\u6700\u540E\u4E00\u5E27\uFF0C\u4FDD\u6301\u540C\u4E00\u6784\u56FE\u3001\u4EBA\u7269\u5927\u5C0F\u3001\u5DE6\u53F3\u4F4D\u7F6E\u3001\u5934\u90E8\u671D\u5411\u3001\u89C6\u7EBF\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\u3002\u52A8\u4F5C\u4FDD\u6301\u539F\u6709\u65B9\u5411\u548C\u901F\u5EA6\uFF0C\u4E0D\u91CD\u590D\u524D\u6BB5\u52A8\u4F5C\u3001\u4E0D\u5B9A\u683C\u7B49\u5F85\u3001\u4E0D\u4ECE\u753B\u9762\u53E6\u4E00\u4FA7\u91CD\u65B0\u5165\u573A\uFF1B\u4E0D\u64C5\u81EA\u5207\u955C\u6216\u91CD\u65B0\u5C45\u4E2D\u3002";
    FORWARD_TRANSITION = "\u5411\u524D\u5EF6\u957F\u65F6\uFF0C\u672C\u6BB5\u6700\u540E\u4E00\u5E27\u5FC5\u987B\u7D27\u63A5\u89C6\u98911\u7B2C\u4E00\u5E27\uFF0C\u4FDD\u6301\u540C\u4E00\u6784\u56FE\u3001\u4EBA\u7269\u5927\u5C0F\u3001\u5DE6\u53F3\u4F4D\u7F6E\u3001\u5934\u90E8\u671D\u5411\u3001\u89C6\u7EBF\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\u3002\u52A8\u4F5C\u671D\u5411\u89C6\u98911\u7684\u5F00\u573A\u52A8\u4F5C\u53D1\u5C55\uFF0C\u4E0D\u91CD\u590D\u524D\u6BB5\u52A8\u4F5C\u3001\u4E0D\u5B9A\u683C\u7B49\u5F85\u3001\u4E0D\u4ECE\u753B\u9762\u53E6\u4E00\u4FA7\u91CD\u65B0\u5165\u573A\uFF1B\u4E0D\u64C5\u81EA\u5207\u955C\u6216\u91CD\u65B0\u5C45\u4E2D\u3002";
    CLOSEUP_TRANSITION = "\u955C\u5934\u8854\u63A5\u5EFA\u8BAE\uFF08\u4EC5\u5728\u672C\u6BB5\u672A\u660E\u786E\u6307\u5B9A\u8FD0\u955C\u6216\u5207\u955C\u5B89\u6392\u65F6\u91C7\u7528\uFF09\uFF1A\u5728\u5B8C\u6574\u53F0\u8BCD\u7ED3\u675F\u5904\u81EA\u7136\u5207\u5230\u4E0B\u4E00\u4F4D\u8BF4\u8BDD\u4EBA\u7684\u8FD1\u666F\u6216\u542C\u8BDD\u4EBA\u7684\u53CD\u5E94\u8FD1\u666F\uFF0C\u518D\u7EE7\u7EED\u672C\u6BB5\u5267\u60C5\u3002\u4FDD\u6301\u8F74\u7EBF\u3001\u89C6\u7EBF\u65B9\u5411\u3001\u5DE6\u53F3\u4EBA\u7269\u5173\u7CFB\u3001\u670D\u88C5\u548C\u97F3\u8272\uFF0C\u4E0D\u4EA4\u6362\u89D2\u8272\uFF1B\u53EA\u6539\u53D8\u666F\u522B\uFF0C\u4E0D\u65B0\u589E\u573A\u666F\u3002";
    CONTENT_REJECTION_HINT = "\u53C2\u8003\u89C6\u9891\u88AB\u4E0A\u6E38\u5185\u5BB9\u5BA1\u6838\u62D2\u7EDD\uFF0C\u5EF6\u957F\u5DF2\u505C\u6B62\u3002Seedance \u542B\u4EBA\u8138\u7EED\u62CD\u9700\u4F7F\u7528\u540C\u4E00\u4E0A\u6E38\u8D26\u53F7\u7684\u53D7\u4FE1\u539F\u59CB\u89C6\u9891\u6216\u6388\u6743\u7D20\u6750\uFF1B\u8BF7\u786E\u8BA4\u4E2D\u8F6C\u7AD9\u900F\u4F20\u4E86\u539F\u59CB video_url \u4E0E reference_video\uFF0C\u4E14\u524D\u540E\u8BF7\u6C42\u4F7F\u7528\u540C\u4E00\u4E0A\u6E38\u8D26\u53F7\u3002\u4E0D\u4F1A\u81EA\u52A8\u53BB\u6389\u53C2\u8003\u89C6\u9891\u751F\u6210\uFF0C\u4EE5\u514D\u4EBA\u7269\u4E0D\u4E00\u81F4\u3002";
    PLUGIN_VERSION = true ? "3.13.15".trim().replace(/^v/i, "") : "";
  }
});

// src/providers/connection.ts
var connection_exports = {};
__export(connection_exports, {
  assertConfigured: () => assertConfigured,
  connectionLabel: () => connectionLabel,
  imageConfig: () => imageConfig,
  isManualKey: () => isManualKey,
  isMetaontic: () => isMetaontic,
  isOmniExtendModel: () => isOmniExtendModel,
  isServerIssuedKey: () => isServerIssuedKey,
  isVolcengine: () => isVolcengine,
  parseExtraParams: () => parseExtraParams,
  relayPreset: () => relayPreset,
  resolveApiKey: () => resolveApiKey,
  resolveBaseUrl: () => resolveBaseUrl,
  resolveModel: () => resolveModel,
  resolveQueryPath: () => resolveQueryPath,
  resolveRegisterApi: () => resolveRegisterApi,
  resolveSubmitPath: () => resolveSubmitPath,
  snapshotConfig: () => snapshotConfig
});
function relayPreset() {
  return RELAY_PRESET;
}
function isVolcengine(config) {
  return ref(config, "connectionMode", "service") === "volcengine";
}
function isMetaontic(config) {
  return ref(config, "connectionMode", "service") === "metaontic";
}
function isManualKey(config) {
  return isVolcengine(config) || isMetaontic(config);
}
function connectionLabel(config) {
  return isMetaontic(config) ? "MetaOntic AI" : "\u706B\u5C71\u5F15\u64CE";
}
function resolveApiKey(config) {
  if (isMetaontic(config)) return String(ref(config, "metaonticApiKey", "")).trim();
  if (isVolcengine(config)) return String(ref(config, "volcengineApiKey", "")).trim();
  return String(ref(config, "apiKey", "")).trim();
}
function isServerIssuedKey(config) {
  if (String(ref(config, "keyOrigin", "")).trim() === KEY_ORIGIN_REGISTER) return true;
  return Boolean(String(ref(config, "deviceId", "")).trim()) && Boolean(String(ref(config, "deviceSecret", "")).trim()) && Boolean(String(ref(config, "registerEmail", "")).trim());
}
function resolveBaseUrl(config) {
  if (isVolcengine(config)) return "https://ark.cn-beijing.volces.com";
  const preset = relayPreset();
  return (String(ref(config, "baseUrl", "")).trim() || envValue(preset.baseEnv) || preset.baseUrl).replace(/\/+$/, "");
}
function resolveSubmitPath(config) {
  if (isVolcengine(config)) return "/api/v3/contents/generations/tasks";
  return String(ref(config, "submitPath", "")).trim() || relayPreset().submitPath;
}
function resolveQueryPath(config, taskId) {
  if (isVolcengine(config)) return `/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`;
  const path14 = String(ref(config, "queryPath", "")).trim() || relayPreset().queryPath;
  return path14.replace("{task_id}", encodeURIComponent(taskId));
}
function resolveModel(config) {
  const preset = relayPreset();
  return String(ref(config, "model", "")).trim() || envValue(preset.modelEnv) || preset.model;
}
function isOmniExtendModel(model) {
  const lowered = String(model).toLowerCase();
  return lowered.includes("seedance-2-5") || lowered.includes("seedance-2.5");
}
function parseExtraParams(config) {
  const raw = String(ref(config, "extraParams", "")).trim();
  if (!raw) return {};
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("\u914D\u7F6E extraParams \u4E0D\u662F\u5408\u6CD5 JSON \u5BF9\u8C61\u5B57\u7B26\u4E32\u3002");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("\u914D\u7F6E extraParams \u5FC5\u987B\u662F JSON \u5BF9\u8C61\u3002");
  }
  return value;
}
function assertConfigured(config, apiKey) {
  if (isMetaontic(config)) {
    if (!apiKey) throw new Error("\u8BF7\u5728 MetaOntic AI \u6A21\u5F0F\u4E2D\u914D\u7F6E API Key\u3002");
    return;
  }
  if (isVolcengine(config)) {
    if (!apiKey) throw new Error("\u8BF7\u5728 C \u706B\u5C71\u5F15\u64CE\u6A21\u5F0F\u4E2D\u914D\u7F6E\u706B\u5C71 API Key\u3002");
    return;
  }
  if (!apiKey) {
    throw new Error(
      "\u672A\u914D\u7F6E API Key\uFF08\u91CD\u7F6E\u540E\u9700\u91CD\u65B0\u767B\u5F55\uFF0C\u65E0\u9700\u91CD\u88C5\u6216\u91CD\u542F\uFF09\uFF1A\u6253\u5F00\u300C\u63D2\u4EF6 \u2192 \u5DF2\u5B89\u88C5\u63D2\u4EF6 \u2192 MetaOnticVideo \u2192 \u67E5\u770B\u300D\uFF0C\u70B9\u300C\u767B\u5F55\u300D\u9886\u4E00\u628A\u2014\u2014\u670D\u52A1\u7AEF\u4F1A\u628A Key\u3001\u4E0A\u6E38\u5730\u5740\u548C\u6A21\u578B\u76F4\u63A5\u5199\u8FDB\u914D\u7F6E\uFF0C\u4E0D\u7528\u624B\u586B\u3002"
    );
  }
  if (!isServerIssuedKey(config)) {
    throw new Error(
      "\u5F53\u524D apiKey \u4E0D\u662F\u670D\u52A1\u7AEF\u4E0B\u53D1\u7684\uFF0C\u63D2\u4EF6\u62D2\u7EDD\u8C03\u7528\uFF1A\u5BC6\u94A5\u53EA\u80FD\u5728\u63D2\u4EF6\u8BE6\u60C5\u9875\u70B9\u300C\u767B\u5F55\u300D\u7531\u670D\u52A1\u7AEF\u4E0B\u53D1\u3002\u540C\u4E00\u4E2A\u90AE\u7BB1\u518D\u767B\u5F55\u4E00\u6B21\u4F1A\u628A\u539F\u6765\u90A3\u628A\u8FD8\u7ED9\u4F60\uFF0C\u4E0D\u4F1A\u591A\u5F00\u4E00\u628A\u3002"
    );
  }
  if (!resolveBaseUrl(config)) {
    throw new Error(
      "\u672A\u914D\u7F6E baseUrl\uFF1A\u6B63\u5E38\u7531\u300C\u767B\u5F55\u300D\u65F6\u670D\u52A1\u7AEF\u4E0B\u53D1\u4E2D\u8F6C\u7AD9\u5730\u5740\uFF1B\u7F3A\u5931\u65F6\u8BF7\u91CD\u65B0\u767B\u5F55\uFF0C\u6216\u68C0\u67E5\u8BBE\u7F6E\u9875\u91CC\u7684\u4E0A\u6E38\u5730\u5740\u3002"
    );
  }
}
function resolveRegisterApi(config) {
  return (String(ref(config, "registerApi", "")).trim() || DEFAULT_REGISTER_API).replace(/\/+$/, "");
}
function snapshotConfig(config) {
  const snapshot2 = {};
  for (const key of Object.keys(config || {})) snapshot2[key] = ref(config, key, void 0);
  snapshot2.connectionMode = isVolcengine(config) ? "volcengine" : isMetaontic(config) ? "metaontic" : "service";
  snapshot2.baseUrl = resolveBaseUrl(config);
  snapshot2.model = resolveModel(config);
  snapshot2.submitPath = resolveSubmitPath(config);
  snapshot2.queryPath = isVolcengine(config) ? "/api/v3/contents/generations/tasks/{task_id}" : String(ref(config, "queryPath", "")).trim() || relayPreset().queryPath;
  return Object.freeze(snapshot2);
}
function imageConfig(config) {
  const snapshot2 = snapshotConfig(config);
  if (!isMetaontic(snapshot2) || ref(snapshot2, "imageUseVideoKey", true) !== false) return snapshot2;
  const key = String(ref(snapshot2, "imageApiKey", "")).trim();
  if (!key) throw new Error("\u5DF2\u5173\u95ED\u56FE\u7247\u4E0E\u89C6\u9891\u5171\u7528 Key\uFF0C\u8BF7\u5355\u72EC\u586B\u5199\u56FE\u7247\u6A21\u578B API Key\u3002");
  return Object.freeze({ ...snapshot2, [isMetaontic(snapshot2) ? "metaonticApiKey" : "apiKey"]: key });
}
var init_connection = __esm({
  "src/providers/connection.ts"() {
    init_config();
  }
});

// src/workflow/storyboard-review.ts
import path4 from "node:path";
import { stat as stat3 } from "node:fs/promises";

// src/utils/logging.ts
import { AsyncLocalStorage } from "node:async_hooks";
import path3 from "node:path";

// src/media/references.ts
import path2 from "node:path";
import os from "node:os";
import { stat as stat2, mkdir as mkdir2, rename, rm, open, readdir, readFile } from "node:fs/promises";

// src/media/ffmpeg.ts
init_config();
import { spawn } from "node:child_process";

// src/utils/errors.ts
init_config();
function upstreamMessage(data) {
  if (data && typeof data === "object") {
    const error = data.error;
    if (error && typeof error === "object") {
      const message = String(error.message || "").trim();
      const code = String(error.code || "").trim();
      if (message) return code ? `${message}\uFF08${code}\uFF09` : message;
    } else if (typeof error === "string" && error.trim()) {
      return error.trim();
    }
    for (const key of ["message", "detail", "msg", "fail_reason"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return data.code ? `${value.trim()}\uFF08${data.code}\uFF09` : value.trim();
    }
  }
  const text = typeof data === "string" ? data : JSON.stringify(data ?? {});
  return text || "\u4E0A\u6E38\u672A\u8FD4\u56DE\u9519\u8BEF\u8BE6\u60C5";
}
function quotaDetail(text) {
  const parts = [];
  const remain = /(?:remain(?:ing)? quota|剩余额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  const need = /(?:need quota|需要预扣费额度|需要额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  if (remain) parts.push(`\u5269\u4F59 ${remain[1]}`);
  if (need) parts.push(`\u9700\u8981 ${need[1]}`);
  return parts.length ? `\uFF08${parts.join("\uFF0C")}\uFF09` : "";
}
function isRealPersonRejection(value) {
  const text = String(value || "");
  return /真人|real[ _-]?person|real[ _-]?human|photorealistic[ _-]?(?:person|human)|human[ _.-]?face|realperson|humanface/i.test(text);
}
function classifyError(statusCode, data) {
  const raw = upstreamMessage(data);
  const lowered = raw.toLowerCase();
  if (statusCode === 402 || QUOTA_HINTS.some((hint) => lowered.includes(hint)) || lowered.includes("quota_exceeded")) {
    return {
      code: "provider_quota_exceeded",
      message: `\u4E2D\u8F6C\u7AD9\u989D\u5EA6\u4E0D\u8DB3${quotaDetail(raw)}\uFF0C\u8BF7\u5145\u503C\u540E\u518D\u8BD5\uFF1A${raw}`
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return { code: "provider_auth", message: `\u4E2D\u8F6C\u7AD9\u9274\u6743\u5931\u8D25\uFF08${statusCode}\uFF09\uFF1A${raw}` };
  }
  if (statusCode === 429) {
    return { code: "provider_rate_limited", message: `\u4E2D\u8F6C\u7AD9\u9650\u6D41\uFF08429\uFF09\uFF1A${raw}` };
  }
  if (isRealPersonRejection(raw)) return { code: "real_person_rejected", message: raw };
  if (CONTENT_HINTS.some((hint) => lowered.includes(hint))) {
    return { code: "content_rejected", message: raw };
  }
  if (PRICE_HINTS.some((hint) => lowered.includes(hint))) {
    return {
      code: "provider_price_config_error",
      message: `\u4E2D\u8F6C\u7AD9\u8BE5\u6A21\u578B\u7684\u8BA1\u4EF7\u914D\u7F6E\u5F02\u5E38\uFF0C\u4E0E\u672C\u6B21\u8BF7\u6C42\u53C2\u6570\u65E0\u5173\uFF0C\u91CD\u8BD5\u4E5F\u4E0D\u4F1A\u6210\u529F\uFF1A${raw}\u3002\u8BF7\u5728\u63D2\u4EF6 config \u91CC\u6362\u7528\u5176\u5B83\u53EF\u7528\u6A21\u578B\u3002`
    };
  }
  return { code: "provider_failed", message: raw };
}
function isContentRejection(text) {
  const lowered = String(text || "").toLowerCase();
  return CONTENT_HINTS.some((hint) => lowered.includes(hint));
}
function abortError() {
  const error = new Error("\u5DF2\u53D6\u6D88");
  error.code = "ABORTED";
  return error;
}
function isRetryablePollError(failure) {
  if (!failure || failure.code === "ABORTED") return false;
  const status = Number(failure.status);
  if (!Number.isFinite(status)) return true;
  if (status >= 500) return true;
  return status === 401 || status === 403 || status === 408 || status === 429;
}

// src/media/ffmpeg.ts
function resolveBinary(config, key, fallback) {
  return String(ref(config, key, "")).trim() || fallback;
}
async function runProcess(binary, args, { signal, timeoutMs = 18e5, shell = false } = {}) {
  return new Promise((resolve3, reject) => {
    let child;
    try {
      child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], ...shell ? { shell: true } : {} });
    } catch (error) {
      reject(Object.assign(new Error(`${binary} \u65E0\u6CD5\u542F\u52A8\uFF1A${error?.message || error}`), {
        code: "ffmpeg_missing"
      }));
      return;
    }
    let stdout = "";
    let stderr = "";
    let done = false;
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    function settle(error = null, value = void 0) {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error);
      else resolve3(value);
    }
    function onAbort() {
      child.kill("SIGKILL");
      settle(abortError());
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(Object.assign(new Error(`${binary} \u6267\u884C\u8D85\u65F6\u3002`), { code: "ffmpeg_timeout" }));
    }, timeoutMs);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (error) => settle(Object.assign(
      new Error(`${binary} \u65E0\u6CD5\u542F\u52A8\uFF1A${error.message}`),
      { code: error.code === "ENOENT" ? "ffmpeg_missing" : "ffmpeg_failed" }
    )));
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => settle(null, { code, stdout, stderr }));
  });
}
async function hasFfmpeg(config, signal) {
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  try {
    const { code } = await runProcess(binary, ["-version"], { signal, timeoutMs: 2e4 });
    return code === 0;
  } catch {
    return false;
  }
}
function currentPlatform() {
  try {
    return typeof process !== "undefined" && process.platform || "linux";
  } catch {
    return "linux";
  }
}
var HOMEBREW_BOOTSTRAP = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
function ffmpegInstallOptions(platform = currentPlatform()) {
  if (platform === "darwin") {
    return {
      os: "macOS",
      installs: [
        { label: "macOS\uFF08Homebrew\uFF09", command: "brew install ffmpeg" },
        {
          label: "macOS\uFF08\u8FD8\u6CA1\u88C5 Homebrew \u5C31\u5148\u88C5\u5B83\uFF09",
          command: HOMEBREW_BOOTSTRAP
        }
      ],
      // 连包管理器都没有时的前置步骤（macOS 才有）
      bootstrap: { label: "macOS\uFF08\u5148\u88C5 Homebrew\uFF09", command: HOMEBREW_BOOTSTRAP }
    };
  }
  if (platform === "win32") {
    return {
      os: "Windows",
      installs: [
        { label: "Windows\uFF08winget\uFF09", command: "winget install --id Gyan.FFmpeg -e" },
        { label: "Windows\uFF08Chocolatey\uFF09", command: "choco install ffmpeg" }
      ],
      bootstrap: null
    };
  }
  return {
    os: "Linux",
    installs: [
      {
        label: "Linux\uFF08Debian / Ubuntu\uFF09",
        command: "sudo apt update && sudo apt install -y ffmpeg"
      },
      { label: "Linux\uFF08Fedora / RHEL / CentOS\uFF09", command: "sudo dnf install -y ffmpeg" }
    ],
    bootstrap: null
  };
}
function commonFfmpegPaths(platform = currentPlatform()) {
  if (platform === "darwin") return ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"];
  if (platform === "win32") return [];
  return ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/snap/bin/ffmpeg"];
}
async function probeBinaryVersion(binary, signal) {
  try {
    const { code, stdout, stderr } = await runProcess(binary, ["-version"], { signal, timeoutMs: 2e4 });
    if (code !== 0) return null;
    const line = String(stdout || stderr).split("\n").map((item) => item.trim()).filter(Boolean)[0];
    return line || "ok";
  } catch {
    return null;
  }
}
async function findInstalledFfmpeg(signal) {
  for (const candidate of commonFfmpegPaths()) {
    if (await probeBinaryVersion(candidate, signal)) return candidate;
  }
  return null;
}
function ffmpegInstallHint(config) {
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  const { os: os3, installs } = ffmpegInstallOptions();
  const lines = [
    `\u672C\u673A\u6CA1\u6709\u627E\u5230\u53EF\u7528\u7684 ffmpeg\uFF08${binary}\uFF09\uFF0C\u6240\u4EE5\u300C\u628A\u591A\u6BB5\u5408\u5E76\u6210\u4E00\u6761\u300D\u8FD9\u6B65\u6682\u65F6\u6CA1\u505A\uFF0C\u5206\u6BB5\u6587\u4EF6\u90FD\u5728\uFF0C\u4E00\u6761\u90FD\u4E0D\u5C11\u3002`,
    `\u88C5\u4E00\u4E0B ffmpeg \u5C31\u80FD\u5408\u5E76\uFF08\u4F60\u5F53\u524D\u662F ${os3}\uFF09\uFF1A`,
    ...installs.map((item) => `  \xB7 ${item.label}\uFF1A${item.command}`),
    "\u88C5\u597D\u540E\u91CD\u8DD1\u8FD9\u6B21\u751F\u6210\uFF0C\u5206\u6BB5\u4F1A\u81EA\u52A8\u5408\u5E76\u6210\u4E00\u6761\uFF0C\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF1B\u5982\u679C ffmpeg \u5DF2\u7ECF\u88C5\u4E86\u4F46\u4E0D\u5728\u9ED8\u8BA4\u4F4D\u7F6E\uFF0C\u628A\u5B83\u7684\u7EDD\u5BF9\u8DEF\u5F84\u586B\u5230\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\u3002",
    "ffmpeg \u7684\u5B89\u88C5\u5305\u91CC\u81EA\u5E26 ffprobe\uFF0C\u88C5\u5B8C\u5206\u6BB5\u63A2\u6D4B\u4E5F\u4E00\u8D77\u597D\u4E86\u3002",
    "\u60F3\u8BA9\u6211\u6765\u88C5\u5C31\u8BF4\u4E00\u58F0 \u2014\u2014 \u6211\u4F1A\u7528 video_setup \u6267\u884C\u5B89\u88C5\uFF08\u6267\u884C\u524D\u5BBF\u4E3B\u4F1A\u5148\u8BA9\u4F60\u786E\u8BA4\u547D\u4EE4\uFF09\u3002"
  ];
  return { binary, os: os3, installs, hint: lines.join("\n") };
}
async function probeMedia(file, config, signal) {
  try {
    const { code, stdout } = await runProcess(resolveBinary(config, "ffprobeBinary", "ffprobe"), [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height,r_frame_rate,duration",
      "-of",
      "json",
      file
    ], { signal, timeoutMs: 6e4 });
    if (code !== 0) return null;
    const parsed = JSON.parse(stdout);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const video = streams.find((stream) => stream.codec_type === "video") || {};
    const audio = streams.find((stream) => stream.codec_type === "audio") || {};
    const [num, den] = String(video.r_frame_rate || "").split("/").map(Number);
    const duration = Number(parsed?.format?.duration);
    const videoDuration = Number(video.duration);
    const audioDuration = Number(audio.duration);
    return {
      durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 0,
      videoDurationSeconds: Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : 0,
      audioDurationSeconds: Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0,
      width: Number(video.width) || 0,
      height: Number(video.height) || 0,
      fps: Number.isFinite(num) && Number.isFinite(den) && den > 0 ? num / den : 0,
      hasAudio: streams.some((stream) => stream.codec_type === "audio")
    };
  } catch {
    return null;
  }
}

// src/utils/files.ts
init_config();
import path from "node:path";
import { mkdir, stat } from "node:fs/promises";
function tail(text, limit = 600) {
  const clean = String(text || "").trim();
  return clean.length > limit ? `\u2026${clean.slice(-limit)}` : clean;
}
function formatSeconds(value) {
  const number2 = Number(value);
  if (!Number.isFinite(number2)) return String(value ?? "");
  return Number.isInteger(number2) ? String(number2) : number2.toFixed(1);
}
var tempSequence = 0;
function uniqueSuffix(prefix = "tmp") {
  tempSequence = (tempSequence + 1) % 1e9;
  return `${prefix}-${process.pid}-${tempSequence}-${Math.random().toString(36).slice(2, 8)}`;
}
function fileStamp(date2 = /* @__PURE__ */ new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date2.getFullYear()}${pad(date2.getMonth() + 1)}${pad(date2.getDate())}-${pad(date2.getHours())}${pad(date2.getMinutes())}${pad(date2.getSeconds())}`;
}
async function allocateStamp(outDir, base) {
  const parent = path.join(outDir, "segments");
  await mkdir(parent, { recursive: true });
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const stamp = attempt === 1 ? base : `${base}-${attempt}`;
    const dir = path.join(parent, stamp);
    try {
      await mkdir(dir);
      return { stamp, segmentsDir: dir };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`\u65E0\u6CD5\u5728 ${parent} \u4E0B\u5206\u914D\u552F\u4E00\u7684\u5206\u6BB5\u76EE\u5F55\uFF08\u540C\u540D\u592A\u591A\uFF09\u3002`);
}
async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}
async function resolveOutputDir(config, exec, deps) {
  const configured = String(ref(config, "outputDir", "")).trim();
  if (configured) return path.resolve(configured);
  let cwd = "";
  if (deps?.workdir && exec?.agent) {
    try {
      cwd = await deps.workdir.ensure(exec.agent, exec.signal) || "";
    } catch {
      cwd = "";
    }
  }
  return path.join(cwd || process.cwd(), DEFAULT_OUTPUT_DIR);
}

// src/media/references.ts
init_connection();
var IMAGE_EXT_TO_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff"
};
var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
function sniffImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("latin1") === "GIF87a" || buffer.subarray(0, 6).toString("latin1") === "GIF89a")) return "image/gif";
  if (buffer.length >= 2 && buffer[0] === 66 && buffer[1] === 77) return "image/bmp";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buffer.length >= 4 && (buffer[0] === 73 && buffer[1] === 73 && buffer[2] === 42 || buffer[0] === 77 && buffer[1] === 77 && buffer[2] === 0)) return "image/tiff";
  return null;
}
var CANVAS_SIZES = {
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "4:3": [960, 720],
  "3:4": [720, 960],
  "1:1": [720, 720]
};
function canvasSize(ratio) {
  return CANVAS_SIZES[String(ratio ?? "").trim()] || null;
}
function referenceCacheDir() {
  return path2.join(os.tmpdir(), "metaontic-video-reference");
}
async function isUsableFit(dest, width, height, config, signal) {
  const info = await stat2(dest).catch(() => null);
  if (!info?.isFile() || info.size <= 0) return false;
  const media = await probeMedia(dest, config, signal);
  if (!media?.width || !media?.height) return true;
  return media.width === width && media.height === height;
}
var fitInFlight = /* @__PURE__ */ new Map();
async function fitImageToCanvas(absPath, size, config, signal) {
  const [width, height] = size;
  const media = await probeMedia(absPath, config, signal);
  if (media?.width === width && media?.height === height) return absPath;
  const info = await stat2(absPath).catch(() => null);
  const key = `${path2.basename(absPath, path2.extname(absPath))}-${info?.size ?? 0}-${Math.round(info?.mtimeMs ?? 0)}-${width}x${height}.jpg`;
  const dest = path2.join(referenceCacheDir(), key);
  if (await isUsableFit(dest, width, height, config, signal)) return dest;
  const running = fitInFlight.get(dest);
  if (running) {
    await running.catch(() => {
    });
    if (await isUsableFit(dest, width, height, config, signal)) return dest;
    if (signal?.aborted) return absPath;
  }
  const task = (async () => {
    await mkdir2(referenceCacheDir(), { recursive: true });
    const graph = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=24[bg];[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;
    const temp = `${dest.replace(/\.jpg$/, "")}.${uniqueSuffix("fit")}.jpg`;
    try {
      const { code } = await runProcess(resolveBinary(config, "ffmpegBinary", "ffmpeg"), [
        "-y",
        "-i",
        absPath,
        "-filter_complex",
        graph,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        temp
      ], { signal, timeoutMs: 12e4 });
      if (code !== 0) return;
      const fitted = await probeMedia(temp, config, signal);
      if (fitted?.width === width && fitted?.height === height) await rename(temp, dest);
    } catch {
    } finally {
      await rm(temp, { force: true }).catch(() => {
      });
    }
  })();
  fitInFlight.set(dest, task);
  try {
    await task;
  } finally {
    fitInFlight.delete(dest);
  }
  return await isUsableFit(dest, width, height, config, signal) ? dest : absPath;
}
var UPLOAD_ALIAS_PATTERN = /^(?:latest|newest|recent|最近上传(?:的图片)?|最新上传(?:的图片)?|刚上传(?:的图片)?|最新图片|刚拖进来的图片)$/i;
var UPLOAD_WINDOW_MS = 2 * 60 * 60 * 1e3;
function dshHome() {
  const fromEnv = String(typeof process !== "undefined" && process.env?.DSH_HOME || "").trim();
  return fromEnv || path2.join(os.homedir(), ".dsh");
}
function attachmentObjectsDir() {
  return path2.join(dshHome(), "attachments", "v1", "objects");
}
async function sniffFileImage(file) {
  let handle;
  try {
    handle = await open(file, "r");
    const head = Buffer.alloc(32);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return sniffImageMime(head.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {
    });
  }
}
async function findRecentUploadedImages(windowMs = UPLOAD_WINDOW_MS) {
  const root = attachmentObjectsDir();
  const shards = await readdir(root, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - windowMs;
  const found = [];
  for (const shard of shards) {
    if (!shard.isDirectory()) continue;
    const dir = path2.join(root, shard.name);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const abs = path2.join(dir, entry.name);
      const info = await stat2(abs).catch(() => null);
      if (!info || info.mtimeMs < cutoff) continue;
      const mime = await sniffFileImage(abs);
      if (mime) found.push({ abs, mime, bytes: info.size, mtimeMs: info.mtimeMs });
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}
function brief(value, limit = 80) {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit)}\u2026\uFF08\u5171 ${text.length} \u5B57\u7B26\uFF09` : text;
}
function inlineBase64Image(raw, label) {
  const compact = String(raw ?? "").replace(/\s+/g, "");
  if (compact.length < 64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  const buffer = Buffer.from(compact, "base64");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `${label} \u89E3\u51FA\u6765\u6709 ${(buffer.length / 1048576).toFixed(1)} MB\uFF0C\u8BF7\u538B\u5230 ${MAX_IMAGE_BYTES / 1048576} MB \u4EE5\u5185\u518D\u4F20\u3002`
    );
  }
  const mime = sniffImageMime(buffer);
  if (mime) return { url: `data:${mime};base64,${compact}`, source: "inline", bytes: buffer.length };
  if (compact.length >= 256) {
    throw new Error(
      `${label} \u770B\u7740\u662F base64\uFF0C\u4F46\u89E3\u51FA\u6765\u7684\u5185\u5BB9\u4E0D\u662F\u56FE\u7247\uFF08\u53EA\u8BA4 jpg/png/webp/bmp/gif/tiff \u7684\u6587\u4EF6\u5934\uFF09\u3002`
    );
  }
  return null;
}
async function resolveImageInput(value, label, fit = null) {
  const raw = String(value ?? "").trim().replace(/^@/, "");
  if (!raw) throw new Error(`${label} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
  if (/^https?:\/\//i.test(raw)) return { url: raw, source: "url" };
  if (/^data:image\//i.test(raw)) return { url: raw, source: "inline" };
  const inlined = inlineBase64Image(raw, label);
  if (inlined) return inlined;
  let abs;
  let info;
  let upload = null;
  const aliasParts = /^([^\s:]+)(?::(\d+))?$/.exec(raw);
  const aliasName = aliasParts ? aliasParts[1] : "";
  const uploadIndex = aliasParts && aliasParts[2] ? Math.max(1, Number(aliasParts[2])) : 1;
  if (UPLOAD_ALIAS_PATTERN.test(aliasName)) {
    const index = uploadIndex;
    const uploads = await findRecentUploadedImages();
    const picked = uploads[index - 1];
    if (!picked) {
      throw new Error(
        `${label} \u5199\u7684\u662F\u300C\u6700\u8FD1\u4E0A\u4F20\u7684\u56FE\u7247\u300D${index > 1 ? `\uFF08\u7B2C ${index} \u65B0\uFF09` : ""}\uFF0C\u4F46 Harness \u9644\u4EF6\u5E93\u91CC\u6700\u8FD1 ${UPLOAD_WINDOW_MS / 36e5} \u5C0F\u65F6\u53EA\u6709 ${uploads.length} \u5F20\u56FE\u7247\uFF0C\u53D6\u4E0D\u5230\u3002\u8BF7\u76F4\u63A5\u628A\u56FE\u7247\u8DEF\u5F84\u6216\u516C\u7F51 URL \u53D1\u8FC7\u6765\u3002`
      );
    }
    abs = picked.abs;
    info = { size: picked.bytes };
    upload = {
      uploadedAt: new Date(picked.mtimeMs).toISOString(),
      recentUploads: uploads.length,
      uploadIndex: index
    };
  } else {
    abs = path2.resolve(raw.startsWith("~/") || raw === "~" ? path2.join(os.homedir(), raw.slice(1)) : raw);
    const ext = path2.extname(abs).toLowerCase();
    if (!IMAGE_EXT_TO_MIME[ext]) {
      throw new Error(
        `${label} \u65E2\u4E0D\u662F http(s) \u94FE\u63A5\u3001base64\uFF0C\u4E5F\u4E0D\u662F\u652F\u6301\u7684\u56FE\u7247\u6587\u4EF6\uFF1A${brief(raw)}\u3002\u672C\u673A\u56FE\u7247\u8BF7\u7528 ${Object.keys(IMAGE_EXT_TO_MIME).join(" / ")} \u4E4B\u4E00\uFF0C\u7528\u6237\u521A\u5728\u5BF9\u8BDD\u91CC\u4E0A\u4F20\u7684\u56FE\u76F4\u63A5\u5199 latest\u3002`
      );
    }
    info = await stat2(abs).catch(() => null);
    if (!info?.isFile()) {
      throw new Error(`${label} \u627E\u4E0D\u5230\u6587\u4EF6\uFF1A${abs}\uFF08\u7528\u6237\u521A\u5728\u5BF9\u8BDD\u91CC\u4E0A\u4F20\u7684\u56FE\u53EF\u4EE5\u76F4\u63A5\u5199 latest\uFF09`);
    }
  }
  const submitPath = fit?.size ? await fitImageToCanvas(abs, fit.size, fit.config, fit.signal) : abs;
  let size = info.size;
  if (submitPath !== abs) {
    const fittedInfo = await stat2(submitPath).catch(() => null);
    if (!fittedInfo?.isFile()) throw new Error(`${label} \u8BFB\u4E0D\u51FA\u6765\uFF1A${abs}`);
    size = fittedInfo.size;
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new Error(
      `${label} \u592A\u5927\uFF08${(size / 1048576).toFixed(1)} MB\uFF09\uFF0C\u8BF7\u538B\u5230 ${MAX_IMAGE_BYTES / 1048576} MB \u4EE5\u5185\u518D\u4F20\uFF1A${abs}`
    );
  }
  const buffer = await readFile(submitPath);
  const mime = sniffImageMime(buffer);
  if (!mime) throw new Error(`${label} \u4E0D\u662F\u6709\u6548\u7684\u56FE\u7247\u6587\u4EF6\uFF08\u8BFB\u5230\u7684\u5185\u5BB9\u4E0D\u662F jpg/png/webp/bmp/gif/tiff\uFF09\uFF1A${abs}`);
  const resolved = {
    url: `data:${mime};base64,${buffer.toString("base64")}`,
    source: upload ? "upload" : "file",
    localPath: submitPath,
    bytes: buffer.length,
    ...upload || {}
  };
  if (submitPath !== abs) {
    resolved.originalPath = abs;
    resolved.fittedTo = `${fit.size[0]}x${fit.size[1]}`;
  }
  return resolved;
}
function validateImageRoles(args, model) {
  const refs = Array.isArray(args.referenceImages) ? args.referenceImages : args.referenceImages ? [args.referenceImages] : [];
  if (args.lastFrameUrl && !args.firstFrameUrl) throw new Error("\u5C3E\u5E27\u5FC5\u987B\u4E0E\u9996\u5E27\u4E00\u8D77\u4F20\u5165\u3002");
  if (refs.length && (args.firstFrameUrl || args.lastFrameUrl)) {
    throw new Error("\u9996\u5C3E\u5E27\u4E0E\u53C2\u8003\u56FE\u6A21\u5F0F\u4E92\u65A5\uFF0C\u8BF7\u9009\u62E9\u4E00\u79CD\uFF1B\u5982\u9700\u7EC4\u5408\uFF0C\u7528\u53C2\u8003\u56FE\u6A21\u5F0F\u5E76\u5728\u63D0\u793A\u8BCD\u6307\u5B9A\u9996\u5C3E\u753B\u9762\u3002");
  }
  const limit = isOmniExtendModel(model) ? 30 : 9;
  if (refs.length > limit) throw new Error(`\u5F53\u524D\u6A21\u578B\u6700\u591A\u652F\u6301 ${limit} \u5F20\u53C2\u8003\u56FE\u3002`);
  if (refs.some((value) => typeof value !== "string" || !value.trim())) throw new Error("\u6BCF\u5F20\u53C2\u8003\u56FE\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u3002");
  return { refs, limit };
}

// src/utils/logging.ts
init_config();
import { mkdir as mkdir3, appendFile } from "node:fs/promises";
var requestLogContext = new AsyncLocalStorage();
function requestLogPath() {
  const now = /* @__PURE__ */ new Date();
  const date2 = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return path3.join(dshHome(), "logs", "metaontic-video", date2, "requests.jsonl");
}
async function appendRequestLog(record) {
  try {
    const file = requestLogPath();
    await mkdir3(path3.dirname(file), { recursive: true, mode: 448 });
    await appendFile(file, JSON.stringify({ time: (/* @__PURE__ */ new Date()).toISOString(), pluginVersion: PLUGIN_VERSION, ...requestLogContext.getStore(), ...record }) + "\n", { mode: 384 });
  } catch {
  }
}

// src/workflow/storyboard-review.ts
function createStoryboardReviewGuard() {
  const sessions = /* @__PURE__ */ new WeakMap();
  function stateFor(session, turn) {
    let state = sessions.get(session);
    if (!state || Number.isInteger(turn) && turn !== state.turn) {
      state = { turn, active: false, files: [], shown: /* @__PURE__ */ new Set() };
      sessions.set(session, state);
    }
    return state;
  }
  function observe(session, event) {
    if (!session || typeof session !== "object") return;
    const data = event?.data || {};
    if (!Number.isInteger(data.turn)) return;
    const state = stateFor(session, data.turn);
    if (event.type === "tool/call" && ["video_estimate", "video_stage"].includes(data.name)) state.active = true;
    if (event.type === "deliverables/presented") {
      const files = (data.files || []).filter((file) => typeof file.path === "string" && /\.(png|jpe?g|webp|svg)$/i.test(file.path) && /storyboard|分镜|示意/i.test(file.path + " " + (file.description || ""))).map((file) => file.path);
      if (files.length) {
        state.active = true;
        state.files = files;
        state.shown.clear();
      }
    }
    if (event.type === "assistant/message") {
      const content = data.message?.content;
      const text = Array.isArray(content) ? content.filter((block) => block.type === "text").map((block) => block.text || "").join("\n") : "";
      for (const match of text.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
        const target = match[1] || match[2];
        try {
          state.shown.add(path4.resolve(session.header?.cwd || process.cwd(), decodeURI(target)));
        } catch {
        }
      }
    }
  }
  async function gate(exec) {
    if (exec?.name !== "ask_user_question" || !exec.agent?.session) return null;
    let args = exec.arguments;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        return null;
      }
    }
    const questions = args?.questions || [];
    const review = questions.some((question) => /script[_-]?review|脚本.*(?:审核|可以|通过|确认)|(?:审核|确认).*脚本/i.test([question.id, question.header, question.question].join(" ")));
    const state = sessions.get(exec.agent.session);
    if (!review || !state?.active) return null;
    let ready = state.files.length > 0 && state.files.every((file) => state.shown.has(path4.resolve(file)));
    if (ready) {
      for (const file of state.files) {
        try {
          if (!(await stat3(file)).isFile()) ready = false;
        } catch {
          ready = false;
        }
      }
    }
    if (ready) return null;
    await appendRequestLog({ event: "storyboard_review_blocked", reason: state.files.length ? "missing_inline_image" : "missing_presented_storyboard" });
    const target = state.files[0];
    return { kind: "deny", reason: "\u811A\u672C\u5BA1\u6838\u6682\u672A\u6253\u5F00\uFF1A\u5206\u955C\u56FE\u5C1A\u672A\u5B8C\u6210\u6B63\u6587\u5C55\u793A\u3002present\u53EA\u767B\u8BB0\u4EA4\u4ED8\uFF0C\u5361\u7247\u5728\u8F6E\u6B21\u7ED3\u675F\u540E\u624D\u51FA\u73B0\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u5BA1\u6838\u65F6\u5DF2\u5C55\u793A\u3002" + (target ? `\u8BF7\u5148\u5728\u72EC\u7ACB\u7684\u7528\u6237\u53EF\u89C1\u6B63\u6587\u8F93\u51FA ![\u5206\u955C\u793A\u610F\u56FE](<${target}>) \u548C [\u6253\u5F00\u539F\u56FE](<${target}>)\u3002` : "\u8BF7\u5148\u786E\u8BA4\u672C\u7248\u5206\u955C\u56FE\u6587\u4EF6\u5B58\u5728\u5E76\u7528present\u767B\u8BB0\uFF0C\u518D\u5728\u72EC\u7ACB\u6B63\u6587\u5185\u5D4C\u56FE\u7247\u5E76\u9644\u539F\u56FE\u94FE\u63A5\u3002") + "\u6B63\u6587\u53D1\u9001\u5B8C\u6210\u540E\u518D\u5355\u72EC\u8C03\u7528ask_user_question\uFF0C\u4E0D\u80FD\u4E0E\u5C55\u793A\u5E76\u884C\uFF1B\u4E0D\u8981\u91CD\u753B\u6216\u8C03\u7528\u4ED8\u8D39\u751F\u6210\u3002" };
  }
  return { observe, gate };
}

// src/workflow/delivery-order.ts
import path5 from "node:path";
import { stat as stat4 } from "node:fs/promises";
function createDeliveryOrderGuard() {
  const sessions = /* @__PURE__ */ new WeakMap();
  function stateFor(session) {
    let state = sessions.get(session);
    if (!state) {
      state = { turn: void 0, mergedShownTurn: void 0, groups: [] };
      sessions.set(session, state);
    }
    return state;
  }
  function absolute(session, target) {
    const value = String(target ?? "").trim();
    if (!value) return "";
    try {
      return path5.resolve(session?.header?.cwd || process.cwd(), value);
    } catch {
      return "";
    }
  }
  const nameOf = (target) => {
    try {
      return path5.basename(target).toLowerCase();
    } catch {
      return "";
    }
  };
  async function sizeOf(target) {
    try {
      const info = await stat4(target);
      return info.isFile() ? info.size : 0;
    } catch {
      return 0;
    }
  }
  async function remember(session, value) {
    if (!session || typeof session !== "object") return;
    const segments = (value?.segments || []).filter((segment) => segment?.status === "succeeded" && segment?.localPath).map((segment) => absolute(session, segment.localPath)).filter(Boolean);
    const film = value?.merged && value?.videoPath ? absolute(session, value.videoPath) : "";
    const distinct = film && !segments.includes(film) ? film : "";
    if (!distinct && !segments.length) return;
    const dir = String(value?.segmentsDir || value?.resumeDir || "").trim() || distinct || segments[0];
    const state = stateFor(session);
    let group = state.groups.find((item) => item.dir === dir);
    if (!group) {
      group = { dir, merges: [], segments: [] };
      state.groups.push(group);
    }
    for (const target of segments) {
      if (!group.segments.some((item) => item.path === target)) group.segments.push({ path: target, size: await sizeOf(target) });
    }
    if (distinct && !group.merges.some((item) => item.path === distinct)) {
      group.merges.push({ path: distinct, size: await sizeOf(distinct) });
    }
  }
  function observe(session, event) {
    if (!session || typeof session !== "object") return;
    const data = event?.data || {};
    const state = stateFor(session);
    if (Number.isInteger(data.turn)) state.turn = data.turn;
    if (event.type !== "deliverables/presented") return;
    const shown = (data.files || []).map((file) => absolute(session, file?.path)).filter(Boolean);
    if (shown.some((target) => state.groups.some((group) => group.merges.some((item) => item.path === target || nameOf(item.path) === nameOf(target))))) {
      state.mergedShownTurn = data.turn;
    }
  }
  function identify(group, target, size) {
    const name = nameOf(target);
    const role2 = (item) => ({ role: group.merges.includes(item) ? "film" : "segment", path: item.path });
    const samePath = (item) => item.path === target || nameOf(item.path) === name;
    const byPath = group.merges.find(samePath) || group.segments.find(samePath);
    if (byPath) return role2(byPath);
    if (!size) return null;
    const bySize = group.merges.find((item) => item.size === size) || group.segments.find((item) => item.size === size);
    return bySize ? role2(bySize) : null;
  }
  async function gate(exec) {
    if (exec?.name !== "present" || !exec.agent?.session) return null;
    const session = exec.agent.session;
    const state = sessions.get(session);
    if (!state?.groups.length) return null;
    let args = exec.arguments;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        return null;
      }
    }
    const files = Array.isArray(args?.files) ? args.files : [];
    const paths = files.map((file) => absolute(session, typeof file === "string" ? file : file?.path)).filter(Boolean);
    if (!paths.length) return null;
    const sizes = /* @__PURE__ */ new Map();
    for (const target of paths) sizes.set(target, await sizeOf(target));
    let best = null;
    for (const group2 of state.groups) {
      const marks2 = paths.map((target) => identify(group2, target, sizes.get(target) || 0));
      const hit = marks2.filter(Boolean).length;
      if (hit && hit > (best?.marks.filter(Boolean).length || 0)) best = { group: group2, marks: marks2 };
    }
    if (!best) return null;
    const { group, marks } = best;
    const latest = group.merges[group.merges.length - 1];
    if (!latest || !latest.path) return null;
    const isLatest = (mark) => Boolean(mark && mark.role === "film" && mark.path === latest.path);
    const filmIndex = marks.findIndex(isLatest);
    const others = marks.map((mark, index) => mark && !isLatest(mark) ? index : -1).filter((index) => index >= 0);
    const order = () => `\u6B63\u786E\u987A\u5E8F\uFF1A1. ${latest.path}
${group.segments.map((item, index) => `${index + 2}. ${item.path}`).join("\n")}`;
    if (filmIndex > 0 && others.some((index) => index < filmIndex)) {
      await appendRequestLog({ event: "delivery_order_blocked", reason: "merged_not_first", files: paths });
      return { kind: "deny", reason: `\u6210\u7247\u5C55\u793A\u987A\u5E8F\u4E0D\u5BF9\uFF1A\u5408\u5E76\u6210\u7247\u5FC5\u987B\u6392\u5728\u6240\u6709\u5206\u6BB5\u4E4B\u524D\u3002\u8BF7\u7ACB\u5373\u91CD\u65B0\u8C03\u7528 present\uFF0C\u628A\u5408\u5E76\u6210\u7247\u653E\u5728 files \u6570\u7EC4\u7B2C\u4E00\u4E2A\uFF0C\u518D\u6309\u6BB5\u53F7\u4F9D\u6B21\u653E\u7B2C\u4E00\u6BB5\u3001\u7B2C\u4E8C\u6BB5\u2026\u2026
${order()}` };
    }
    if (filmIndex >= 0) return null;
    if (!others.length) return null;
    if (Number.isInteger(state.turn) && state.mergedShownTurn === state.turn) return null;
    await appendRequestLog({ event: "delivery_order_blocked", reason: "merged_missing", files: paths });
    return { kind: "deny", reason: `\u8FD9\u6B21\u53EA\u5C55\u793A\u4E86\u5206\u6BB5\uFF0C\u6210\u7247\u8981\u6392\u5728\u7B2C\u4E00\u4E2A\u4F4D\u7F6E\u3002\u8BF7\u7ACB\u5373\u91CD\u65B0\u8C03\u7528 present\uFF0C\u628A\u5408\u5E76\u6210\u7247\u653E\u5728 files \u6570\u7EC4\u7B2C\u4E00\u4E2A\uFF0C\u518D\u6309\u6BB5\u53F7\u4F9D\u6B21\u653E\u5206\u6BB5\u3002
${order()}` };
  }
  return { remember, observe, gate };
}

// src/tools/video-stage.ts
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
var STAGES = ["script_design", "storyboard_design", "script_present", "script_review_wait", "production_confirm_wait", "reference_review_wait", "segment_review_wait", "result_present"];
var pendingStages = /* @__PURE__ */ new Map();
async function closePendingStage(stage, source) {
  let target;
  for (const [spanId, entry2] of pendingStages) if (entry2.stage === stage) target = spanId;
  if (!target) return null;
  const entry = pendingStages.get(target);
  pendingStages.delete(target);
  const elapsedMs = Math.round((performance.now() - entry.start) * 1e3) / 1e3;
  await appendRequestLog({
    event: "stage_finished",
    stage: entry.stage,
    spanId: target,
    startedAt: entry.startedAt,
    finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
    elapsedMs,
    outcome: "success",
    source
  });
  return { spanId: target, elapsedMs };
}
function stageTool() {
  return {
    name: "video_stage",
    description: "\u53EA\u8BFB\u8BA1\u65F6\u6807\u8BB0\uFF0C\u4E0D\u751F\u6210\u3001\u4E0D\u6263\u8D39\u3001\u4E0D\u6539\u914D\u7F6E\u3002\u811A\u672C\u8BBE\u8BA1/\u793A\u610F\u56FE/\u5C55\u793A/\u7B49\u5F85\u5BA1\u6838\u7B49\u9636\u6BB5\u5F00\u59CB\u65F6action=start\uFF0C\u7ED3\u675F\u65F6action=finish\u5E76\u4F20\u539FspanId\u3002\u811A\u672C\u8BBE\u8BA1\u4E00\u6BB5\u5728\u811A\u672C\u4FDD\u5B58\u5230script.md\u540E\u7531\u63D2\u4EF6\u81EA\u52A8\u7ED3\u675F\uFF0C\u6B64\u65F6\u4E0D\u5FC5\u518D\u8C03finish\uFF1B\u811A\u672C\u4E0D\u662F\u7528\u5199\u6587\u4EF6\u5DE5\u5177\u4FDD\u5B58\u65F6\u518D\u8865finish\u3002\u8017\u65F6\u662F\u6807\u8BB0\u8FB9\u754C\u95F4\u5899\u949F\u65F6\u95F4\uFF08\u5305\u542B\u5DE5\u5177\u8C03\u5EA6\uFF09\uFF0C\u4E0D\u662F\u6A21\u578B\u7EAF\u63A8\u7406\u8017\u65F6\uFF1B\u7B49\u5F85\u7528\u6237\u5355\u72EC\u8BB0\u9636\u6BB5\u3002\u7F3A\u5931\u5F00\u59CB\u6216\u70ED\u91CD\u8F7D\u4E22\u5931\u6807\u8BB0\u65F6\u8FD4\u56DEunavailable\uFF0C\u4E0D\u731C\u8017\u65F6\u3002",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["start", "finish"] }, stage: { type: "string", enum: STAGES }, spanId: { type: "string" }, outcome: { type: "string", enum: ["success", "cancelled", "error"] } }, required: ["action", "stage"] },
    output: { schema: { type: "object", properties: { status: { type: "string" }, spanId: { type: "string" }, elapsedMs: { type: "number" } } }, render(_args, value) {
      return [{ type: "text", text: JSON.stringify(value) }];
    } },
    timeoutMs: 1e4,
    isConcurrencySafe() {
      return true;
    },
    async execute(args) {
      if (!STAGES.includes(args?.stage)) throw new Error("\u672A\u77E5\u8BA1\u65F6\u9636\u6BB5");
      if (args.action === "start") {
        if (pendingStages.size >= 512) return { status: "unavailable" };
        const spanId = randomUUID(), startedAt = (/* @__PURE__ */ new Date()).toISOString();
        pendingStages.set(spanId, { stage: args.stage, startedAt, start: performance.now() });
        await appendRequestLog({ event: "stage_started", stage: args.stage, spanId, startedAt, source: "assistant_marker" });
        return { status: "started", spanId };
      }
      if (args.action !== "finish") throw new Error("\u672A\u77E5\u8BA1\u65F6\u52A8\u4F5C");
      const entry = pendingStages.get(args.spanId);
      if (!entry || entry.stage !== args.stage) return { status: "unavailable" };
      pendingStages.delete(args.spanId);
      const elapsedMs = Math.round((performance.now() - entry.start) * 1e3) / 1e3;
      const outcome = ["success", "cancelled", "error"].includes(args.outcome) ? args.outcome : "success";
      await appendRequestLog({ event: "stage_finished", stage: entry.stage, spanId: args.spanId, startedAt: entry.startedAt, finishedAt: (/* @__PURE__ */ new Date()).toISOString(), elapsedMs, outcome, source: "assistant_marker" });
      return { status: "finished", spanId: args.spanId, elapsedMs };
    }
  };
}

// src/workflow/script-tracking.ts
var SCRIPT_FILE = /^script(?:[-_]?v?\d+)?\.md$/i;
var WRITE_TOOLS = /* @__PURE__ */ new Set(["write", "edit", "multi_edit", "multiedit", "apply_patch"]);
var PATCH_FILE_LINE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gim;
function fileBaseName(target) {
  return String(target ?? "").split(/[\\/]/).pop() || "";
}
function isScriptPath(target) {
  return SCRIPT_FILE.test(fileBaseName(target));
}
function toolArguments(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
function scriptSaveOf(event) {
  if (event?.type !== "tool/call") return null;
  const data = event.data || {};
  const name = String(data.name || "");
  if (!WRITE_TOOLS.has(name)) return null;
  const args = toolArguments(data.arguments);
  const direct = args.file_path || args.path || args.filePath;
  if (isScriptPath(direct)) return { path: String(direct), tool: name, mode: name === "write" ? "create" : "update" };
  if (name !== "apply_patch") return null;
  const text = String(args.patch ?? args.input ?? "");
  for (const match of text.matchAll(PATCH_FILE_LINE)) {
    if (isScriptPath(match[1])) return { path: match[1].trim(), tool: name, mode: "update" };
  }
  return null;
}
function scriptVersion(content) {
  const match = /版本[:：]\s*(第?\s*\d+\s*版)/.exec(String(content ?? ""));
  return match ? match[1].replace(/\s+/g, "") : void 0;
}
function createScriptTracker({ closeStage = closePendingStage, log = appendRequestLog } = {}) {
  async function observe(session, event) {
    if (!session || typeof session !== "object") return;
    const save2 = scriptSaveOf(event);
    if (!save2) return;
    try {
      const content = toolArguments((event.data || {}).arguments).content;
      const text = typeof content === "string" ? content : "";
      const closed = await closeStage("script_design", "script_saved");
      await log({
        event: "script_saved",
        path: save2.path,
        tool: save2.tool,
        mode: save2.mode,
        bytes: text ? Buffer.byteLength(text, "utf8") : void 0,
        characters: text ? text.length : void 0,
        version: scriptVersion(text),
        turn: (event.data || {}).turn,
        closedSpanId: closed?.spanId,
        closedElapsedMs: closed?.elapsedMs
      });
    } catch {
    }
  }
  return { observe };
}

// src/utils/timing.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { performance as performance2 } from "node:perf_hooks";
async function timedStage(stage, operation) {
  const spanId = randomUUID2();
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const start = performance2.now();
  await appendRequestLog({ event: "stage_started", stage, spanId, startedAt });
  let outcome = "error";
  try {
    const result = await operation();
    outcome = ["failed", "unknown", "timeout", "cancelled", "pending", "review_required"].includes(result?.status) ? result.status : "success";
    return result;
  } catch (error) {
    outcome = error?.name === "AbortError" || error?.code === "ABORTED" ? "cancelled" : "error";
    throw error;
  } finally {
    await appendRequestLog({
      event: "stage_finished",
      stage,
      spanId,
      startedAt,
      finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      elapsedMs: Math.round((performance2.now() - start) * 1e3) / 1e3,
      outcome
    });
  }
}
function withStageTiming(tool) {
  return { ...tool, async execute(args, exec) {
    const context = { ...requestLogContext.getStore(), callId: exec?.callId || randomUUID2(), tool: tool.name };
    return requestLogContext.run(context, () => timedStage(`tool:${tool.name}`, () => tool.execute(args, exec)));
  } };
}

// src/workflow/actual-cost.ts
init_connection();
function number(value) {
  if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function object(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return object(JSON.parse(value));
    } catch {
    }
  }
  return {};
}
function settledTaskCosts(logs, taskIds) {
  return [...new Set(taskIds)].map((taskId) => {
    const matches = logs.filter((row) => Number(row.type) === 2 && object(row.other).task_id === taskId && number(object(row.other).actual_quota) !== null).sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0) || Number(b.id || 0) - Number(a.id || 0));
    if (!matches.length) return { taskId, status: "pending", quota: null };
    return { taskId, status: "settled", quota: number(object(matches[0].other).actual_quota) };
  });
}
async function fetchActualCost(config, taskIds, signal) {
  if (isVolcengine(config)) return void 0;
  const tasks = settledTaskCosts([], taskIds);
  if (!tasks.length) return void 0;
  const pending = (reason) => ({ status: "pending", source: "relay_settlement", tasks, amount: null, currency: null, reason });
  if (signal?.aborted) return pending("\u8D39\u7528\u5F85\u67E5\u8BE2\uFF1A\u672C\u6B21\u64CD\u4F5C\u5DF2\u505C\u6B62\uFF0C\u53EF\u7A0D\u540E\u7528video_status\u8865\u67E5\u3002");
  const key = resolveApiKey(config);
  const base = resolveBaseUrl(config).replace(/\/v1\/?$/, "");
  if (!key || !base) return pending("\u8D39\u7528\u5F85\u67E5\u8BE2\uFF1A\u539F\u8C03\u7528\u8FDE\u63A5\u4E0D\u53EF\u7528\u3002");
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(8e3)]) : AbortSignal.timeout(8e3);
  async function get(path14, authenticated) {
    const response = await fetch(`${base}${path14}`, {
      method: "GET",
      redirect: "error",
      signal: requestSignal,
      headers: { accept: "application/json", ...authenticated ? { Authorization: `Bearer ${key}` } : {} }
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.success === false || body.code !== void 0 && body.code !== 0) throw Error("\u67E5\u8BE2\u4E0D\u53EF\u7528");
    return body;
  }
  try {
    const body = await get("/api/log/token", true);
    const rows = Array.isArray(body.data) ? body.data : body.data?.items;
    if (!Array.isArray(rows)) return pending("\u8D39\u7528\u5F85\u67E5\u8BE2\uFF1A\u4E2D\u8F6C\u7AD9\u672A\u8FD4\u56DE\u6709\u6548\u6D88\u8D39\u65E5\u5FD7\u3002");
    const settled = settledTaskCosts(rows, taskIds);
    const known = settled.filter((x) => x.status === "settled");
    if (!known.length) return pending("\u5F85\u7ED3\u7B97\uFF1A\u672CKey\u6700\u8FD1\u65E5\u5FD7\u4E2D\u5C1A\u672A\u627E\u5230\u8BE5\u4EFB\u52A1\u7684\u6700\u7EC8\u7ED3\u7B97\uFF0C\u53EF\u7528video_status\u8865\u67E5\u3002");
    let conversion;
    try {
      const settings = (await get("/api/status", false)).data;
      const perUnit = number(settings?.quota_per_unit);
      const exchange = number(settings?.usd_exchange_rate);
      if (perUnit && exchange) conversion = { quotaPerUnit: perUnit, usdExchangeRate: exchange, currency: "CNY" };
    } catch {
    }
    const quota = known.reduce((sum, task) => sum + task.quota, 0);
    const taskCosts = settled.map((task) => ({
      ...task,
      amount: task.quota !== null && conversion ? Math.round(task.quota / conversion.quotaPerUnit * conversion.usdExchangeRate * 1e6) / 1e6 : null
    }));
    return {
      status: known.length === settled.length ? "settled" : "partial",
      source: "relay_settlement",
      tasks: taskCosts,
      quota,
      amount: conversion ? Math.round(quota / conversion.quotaPerUnit * conversion.usdExchangeRate * 1e6) / 1e6 : null,
      currency: conversion?.currency ?? null,
      conversion: conversion ?? null,
      reason: known.length !== settled.length ? "\u90E8\u5206\u4EFB\u52A1\u5F85\u7ED3\u7B97\uFF1B\u5F53\u524D\u91D1\u989D\u4EC5\u4E3A\u5DF2\u7ED3\u7B97\u5C0F\u8BA1\uFF0C\u4E0D\u662F\u6574\u6761\u89C6\u9891\u6700\u7EC8\u8D39\u7528\u3002" : conversion ? "" : "\u5DF2\u83B7\u53D6\u5B9E\u9645\u6D88\u8017\u989D\u5EA6\uFF0C\u91D1\u989D\u6362\u7B97\u8BBE\u7F6E\u6682\u4E0D\u53EF\u7528\u3002"
    };
  } catch {
    return pending("\u8D39\u7528\u5F85\u67E5\u8BE2\uFF1A\u4E2D\u8F6C\u7AD9\u6D88\u8D39\u65E5\u5FD7\u67E5\u8BE2\u5931\u8D25\u6216\u65E0\u6743\u9650\uFF1B\u89C6\u9891\u7ED3\u679C\u4E0D\u53D7\u5F71\u54CD\uFF0C\u53EF\u7A0D\u540E\u7528video_status\u8865\u67E5\u3002");
  }
}
function actualCostText(cost, partialVideo = false) {
  if (!cost) return "";
  const amount = (value) => `\xA5${value.toFixed(value >= 1 ? 2 : 4)}`;
  if (cost.status === "pending") return `\u5B9E\u9645\u6D88\u8017\uFF1A${cost.reason}`;
  const totalLabel = cost.status === "partial" ? "\u5DF2\u7ED3\u7B97\u5C0F\u8BA1" : partialVideo ? "\u5DF2\u751F\u6210\u90E8\u5206\u5B9E\u9645\u6D88\u8017" : "\u5B9E\u9645\u6D88\u8017\u5408\u8BA1";
  const lines = cost.tasks.map((task) => task.status === "settled" ? `\u4EFB\u52A1 ${task.taskId} \u5B9E\u9645\u6D88\u8017\uFF1A${task.amount !== null ? amount(task.amount) : `${task.quota}\u989D\u5EA6`}` : `\u4EFB\u52A1 ${task.taskId}\uFF1A\u5F85\u7ED3\u7B97`);
  lines.push(`${totalLabel}\uFF1A${cost.amount !== null ? amount(cost.amount) : `${cost.quota}\u989D\u5EA6`}\uFF08\u4E2D\u8F6C\u7AD9\u5B9E\u9645\u7ED3\u7B97\uFF0C\u89C6\u9891\u8D39\u7528\uFF09`);
  if (cost.reason) lines.push(cost.reason);
  return lines.join("\n");
}
var ACTUAL_COST_SCHEMA = { type: "object", properties: {
  status: { type: "string", enum: ["pending", "partial", "settled"] },
  source: { type: "string" },
  quota: { type: "number" },
  amount: { oneOf: [{ type: "number" }, { type: "null" }] },
  currency: { oneOf: [{ type: "string" }, { type: "null" }] },
  reason: { type: "string" },
  conversion: { oneOf: [{ type: "object" }, { type: "null" }] },
  tasks: { type: "array", items: { type: "object", properties: {
    taskId: { type: "string" },
    status: { type: "string" },
    quota: { oneOf: [{ type: "number" }, { type: "null" }] },
    amount: { oneOf: [{ type: "number" }, { type: "null" }] }
  } } }
} };
function withActualCost(tool, liveConfig) {
  return {
    ...tool,
    output: {
      ...tool.output,
      schema: { ...tool.output.schema, properties: { ...tool.output.schema.properties, actualCost: ACTUAL_COST_SCHEMA } },
      render(args, value) {
        const rendered = tool.output.render(args, value);
        const text = actualCostText(value?.actualCost, Boolean(value?.paused || value?.status !== "succeeded"));
        return text ? [...rendered, { type: "text", text }] : rendered;
      }
    },
    async execute(args, exec) {
      const config = snapshotConfig(liveConfig);
      const result = await tool.execute(args, exec);
      if (isVolcengine(config)) return result;
      const ids = result?.segments ? result.segments.filter((s) => s.status === "succeeded" && s.taskId).map((s) => s.taskId) : result?.status === "succeeded" && result?.taskId ? [result.taskId] : [];
      if (!ids.length) return result;
      try {
        const actualCost = await timedStage("actual_cost_query", () => fetchActualCost(config, ids, exec?.signal));
        return actualCost ? { ...result, actualCost } : result;
      } catch {
        return result;
      }
    }
  };
}

// src/workflow/execution.ts
import { createRequire } from "node:module";
import path6 from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
var progressRecordModule;
async function appendVideoExecution(exec, phase) {
  if (!exec?.agent?.session || !exec.callId) return;
  try {
    const resolver = createRequire(import.meta.url);
    const modulePath = resolver.resolve("@deepseek-ai/dsh-session", {
      paths: [path6.dirname(process.argv[1] || process.execPath), path6.dirname(fileURLToPath(import.meta.url))]
    });
    progressRecordModule ??= import(pathToFileURL(modulePath).href);
    const { appendPluginRecord } = await progressRecordModule;
    appendPluginRecord(exec.agent.session, "plugin:metaontic-video/execution", { callId: exec.callId, phase });
  } catch {
  }
}
function withVideoExecution(tool, onResult = void 0) {
  return {
    ...tool,
    async execute(args, exec) {
      await appendVideoExecution(exec, "start");
      let value;
      try {
        value = await tool.execute(args, exec);
      } finally {
        await appendVideoExecution(exec, "end");
      }
      try {
        await onResult?.(exec?.agent?.session, value);
      } catch {
      }
      return value;
    }
  };
}

// src/workflow/resume.ts
init_config();
import path7 from "node:path";
import { readFile as readFile2, open as open2, rm as rm2, mkdir as mkdir4, writeFile, rename as rename2 } from "node:fs/promises";
import os2 from "node:os";
init_connection();

// src/workflow/planning.ts
init_connection();

// src/utils/validation.ts
function clampInteger(value, min, max, fallback) {
  const number2 = Number(value);
  if (!Number.isFinite(number2)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number2)));
}
function finiteNumber(value) {
  const number2 = Number(value);
  return Number.isFinite(number2) ? number2 : null;
}

// src/workflow/planning.ts
init_config();
function modelMaxSeconds(config) {
  return isOmniExtendModel(resolveModel(config)) ? 30 : 15;
}
function resolveSingleMax(config) {
  return modelMaxSeconds(config);
}
function resolveSegmentSeconds(config, requested = void 0) {
  const max = modelMaxSeconds(config);
  return clampInteger(requested, MIN_SEGMENT_SECONDS, max, max);
}
function maxTargetSeconds(singleMax, segmentSeconds) {
  return Math.min(MAX_TOTAL_SECONDS, singleMax + (MAX_SEGMENTS - 1) * segmentSeconds);
}
function planVideoSegments(totalSeconds, singleMax, segmentSeconds) {
  if (totalSeconds <= singleMax) return [{ kind: "generate", seconds: totalSeconds }];
  let base = singleMax;
  let remaining = totalSeconds - base;
  if (remaining < MIN_SEGMENT_SECONDS) {
    const trimmed = MIN_SEGMENT_SECONDS - remaining;
    if (base - trimmed >= MIN_SEGMENT_SECONDS) {
      base -= trimmed;
      remaining = totalSeconds - base;
    }
  }
  const slots = MAX_SEGMENTS - 1;
  const count = Math.min(slots, Math.max(1, Math.ceil(remaining / segmentSeconds)));
  const sizes = [];
  let left = remaining;
  for (let index = count; index > 0 && left > 0; index -= 1) {
    let size = Math.min(segmentSeconds, Math.ceil(left / index));
    if (size < MIN_SEGMENT_SECONDS) size = Math.min(segmentSeconds, MIN_SEGMENT_SECONDS);
    sizes.push(size);
    left -= size;
  }
  const plan = [{ kind: "generate", seconds: base }];
  for (const seconds of sizes) {
    if (plan.length >= MAX_SEGMENTS) break;
    plan.push({ kind: "extend", seconds });
  }
  return plan;
}
function resolveSegmentPrompts(prompts, planLength) {
  if (prompts === void 0 && planLength === 1) return null;
  if (!Array.isArray(prompts) || prompts.length !== planLength || prompts.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(`\u8BF7\u6309\u5B8C\u6574\u751F\u6210\u8BA1\u5212\u63D0\u4F9B segmentPrompts\uFF1A${planLength} \u6761\u975E\u7A7A\u7684\u9010\u6BB5\u63D0\u793A\u8BCD\uFF0C\u6BCF\u6761\u4EC5\u542B\u672C\u6BB5\u52A8\u4F5C\u4E0E\u5BF9\u767D\u3002\u5148\u8865\u9F50\u63D0\u793A\u8BCD\u518D\u63D0\u4EA4\uFF0C\u4E0D\u8981\u91CD\u65B0\u751F\u6210\u5DF2\u5B8C\u6210\u5206\u6BB5\u3002`);
  }
  return prompts.map((value) => value.trim());
}
function resolveTargetPlan(config, args) {
  const singleMax = resolveSingleMax(config);
  const segmentSeconds = resolveSegmentSeconds(config, args?.segmentSeconds);
  const cap = maxTargetSeconds(singleMax, segmentSeconds);
  const asked = clampInteger(
    args?.duration ?? singleMax,
    MIN_SECONDS,
    Number.MAX_SAFE_INTEGER,
    singleMax
  );
  const total = Math.min(asked, cap);
  return {
    plan: planVideoSegments(total, singleMax, segmentSeconds),
    singleMax,
    segmentSeconds,
    cap,
    asked,
    total
  };
}
function sumStepSeconds(steps) {
  return (steps || []).reduce((sum, step) => sum + (Number(step?.seconds) || 0), 0);
}

// src/workflow/resume.ts
var PAUSE_FILE = "paused-plan.json";
function resumeDirOf(value) {
  const raw = typeof value === "string" ? value : value?.dir ?? value?.path ?? value?.resumeDir ?? value?.token ?? "";
  const dir = String(raw ?? "").trim();
  return dir ? path7.resolve(dir) : "";
}
async function readPauseFile(dir) {
  const file = path7.join(dir, PAUSE_FILE);
  let text;
  try {
    text = await readFile2(file, "utf8");
  } catch {
    throw new Error(
      `\u6CA1\u6709\u627E\u5230\u6682\u505C\u8BB0\u5F55\uFF1A${file}\u3002resume \u8981\u4F20\u4E0A\u4E00\u6B21\u7ED3\u679C\u91CC\u7684 resumeDir\uFF08\u7528\u6237\u9009\u62E9\u5148\u4E0D\u7EE7\u7EED\u65F6\uFF0C\u7ED3\u679C\u91CC\u7ED9\u7684\u90A3\u4E2A\u5206\u6BB5\u76EE\u5F55\uFF09\uFF0C\u4E0D\u8981\u81EA\u5DF1\u62FC\u8DEF\u5F84\u3002`
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`\u6682\u505C\u8BB0\u5F55\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${file}\u3002`);
  }
  if (data?.plugin !== "metaontic-video" || !Array.isArray(data.plan) || !data.plan.length) {
    throw new Error(`\u6682\u505C\u8BB0\u5F55\u5185\u5BB9\u4E0D\u5BF9\uFF08\u4E0D\u662F\u672C\u63D2\u4EF6\u5199\u7684\uFF09\uFF1A${file}\u3002`);
  }
  return data;
}
var RESUME_LOCK = "resume.lock";
function resumeLockStaleMs(config) {
  const minutes = Number(ref(config, "resumeLockStaleMinutes", 60));
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return minutes * 60 * 1e3;
}
async function resumeLockExpired(file, staleMs) {
  const raw = await readFile2(file, "utf8").catch(() => null);
  if (raw === null) return true;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return true;
  }
  const started = Date.parse(String(data?.startedAt || ""));
  if (!Number.isFinite(started)) return true;
  if (!staleMs) return false;
  return Date.now() - started > staleMs;
}
async function describeResumeLock(file) {
  const raw = await readFile2(file, "utf8").catch(() => null);
  if (!raw) return "";
  try {
    const data = JSON.parse(raw);
    const bits = [data?.tool, data?.startedAt && `${data.startedAt} \u5F00\u59CB`, data?.pid && `pid ${data.pid}`].filter(Boolean);
    return bits.length ? `\uFF08${bits.join("\uFF0C")}\uFF09` : "";
  } catch {
    return "";
  }
}
async function acquireResumeLock(dir, { toolName, callId, staleMs }) {
  const empty = { file: null, async release() {
  } };
  const file = path7.join(dir, RESUME_LOCK);
  const token = uniqueSuffix("lock");
  const record = {
    tool: toolName,
    callId: callId || null,
    pid: process.pid,
    host: os2.hostname(),
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    token
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open2(file, "wx");
      try {
        await handle.writeFile(`${JSON.stringify(record, null, 2)}
`, "utf8");
      } finally {
        await handle.close();
      }
      return {
        file,
        async release() {
          const raw = await readFile2(file, "utf8").catch(() => null);
          if (raw) {
            try {
              if (JSON.parse(raw)?.token !== token) return;
            } catch {
              return;
            }
          }
          await rm2(file, { force: true }).catch(() => {
          });
        }
      };
    } catch (failure) {
      if (failure?.code === "ENOENT") return empty;
      if (failure?.code !== "EEXIST") throw failure;
      if (attempt === 0 && await resumeLockExpired(file, staleMs)) {
        await rm2(file, { force: true }).catch(() => {
        });
        continue;
      }
      const holder = await describeResumeLock(file);
      const minutes = staleMs ? Math.round(staleMs / 6e4) : 0;
      throw Object.assign(new Error(
        `\u8FD9\u4EFD\u6682\u505C\u8FDB\u5EA6\u5DF2\u7ECF\u6709\u4E00\u6B21\u300C\u7EE7\u7EED\u300D\u5728\u8DD1\u4E86${holder}\uFF0C\u5148\u522B\u540C\u65F6\u7EED\u505A\uFF1A\u4E24\u4EFD\u8BF7\u6C42\u4F1A\u628A\u5269\u4E0B\u7684\u6BB5\u5404\u63D0\u4EA4\u4E00\u904D\u3001\u91CD\u590D\u6263\u8D39\u3002\u7B49\u5B83\u8DD1\u5B8C\u518D\u7528 resume\uFF08\u7ED3\u679C\u91CC\u4F1A\u8BF4\u5B8C\u6210\u7247\u5728\u54EA\uFF09\u3002` + (minutes ? `\u5982\u679C\u786E\u8BA4\u90A3\u4E00\u6B21\u5DF2\u7ECF\u4E2D\u65AD\u4E86\uFF0C\u7B49 ${minutes} \u5206\u949F\u9501\u4F1A\u81EA\u52A8\u8FC7\u671F\uFF0C\u4E5F\u53EF\u4EE5\u628A ${file} \u5220\u6389\u518D\u8BD5\u3002` : `\u786E\u8BA4\u90A3\u4E00\u6B21\u5DF2\u7ECF\u4E2D\u65AD\u4E86\u5C31\u5220\u6389 ${file} \u518D\u8BD5\u3002`)
      ), { code: "resume_locked" });
    }
  }
  throw new Error(`\u62FF\u4E0D\u5230 ${file} \u7684\u9501\uFF08\u540C\u540D\u6587\u4EF6\u4E00\u76F4\u88AB\u62A2\uFF09\uFF0C\u7A0D\u540E\u91CD\u8BD5\u3002`);
}
function withResumeLock(tool, toolName, config) {
  return {
    ...tool,
    async execute(args, exec) {
      return requestLogContext.run({ callId: exec?.callId || uniqueSuffix("call"), tool: toolName }, async () => {
        const started = Date.now();
        const dir = resumeDirOf(args?.resume);
        let lock;
        await appendRequestLog({
          event: "tool_started",
          provider: isMetaontic(config) ? "metaontic" : isVolcengine(config) ? "volcengine" : "service",
          model: resolveModel(config),
          duration: args?.duration,
          segmentSeconds: args?.segmentSeconds,
          resuming: Boolean(dir),
          resumeDir: dir || void 0
        });
        try {
          if (dir) {
            lock = await acquireResumeLock(dir, { toolName, callId: exec?.callId, staleMs: resumeLockStaleMs(config) });
            await appendRequestLog({ event: "resume_lock_acquired", resumeDir: dir });
          }
          const result = await tool.execute(args, exec);
          if (result?.resumeDir) {
            const record = await readPauseFile(result.resumeDir);
            record.deliveryPending = Boolean(result.deliveryError || result.ffmpegMissing);
            await writePauseFile(result.resumeDir, record);
          }
          await appendRequestLog({
            event: "tool_completed",
            elapsedMs: Date.now() - started,
            status: result?.status,
            paused: result?.paused,
            videoPath: result?.videoPath,
            segmentsDir: result?.segmentsDir,
            segmentCount: result?.segments?.length,
            actualSeconds: result?.actualSeconds,
            errorCode: result?.errorCode
          });
          return result;
        } catch (error) {
          await appendRequestLog({ event: "tool_failed", elapsedMs: Date.now() - started, errorCode: String(error?.code || "tool_error") });
          throw error;
        } finally {
          if (lock) {
            await lock.release();
            await appendRequestLog({ event: "resume_lock_released", resumeDir: dir });
          }
        }
      });
    }
  };
}
async function writePauseFile(dir, data) {
  await mkdir4(dir, { recursive: true, mode: 448 });
  const file = path7.join(dir, PAUSE_FILE);
  const temp = `${file}.${uniqueSuffix("part")}`;
  try {
    await writeFile(temp, `${JSON.stringify(data, null, 2)}
`, { encoding: "utf8", mode: 384 });
    await rename2(temp, file);
  } catch (failure) {
    await rm2(temp, { force: true }).catch(() => {
    });
    throw failure;
  }
}
function resumePlanFrom(data, { askedTotal, segmentSeconds }) {
  const done = Number(data.done) || 0;
  const cursor = Number(data.cursor) || 0;
  const fullPlan = (data.plan || []).map((step) => ({ ...step }));
  const remaining = fullPlan.slice(done).map((step) => ({ ...step }));
  const wanted = Number.isFinite(askedTotal) ? Math.min(askedTotal, MAX_TOTAL_SECONDS) : 0;
  const cap = segmentSeconds > 0 ? segmentSeconds : MAX_SEGMENT_SECONDS;
  let total = cursor + sumStepSeconds(remaining);
  while (wanted > total && fullPlan.length < MAX_SEGMENTS && total + MIN_SECONDS <= wanted) {
    const seconds = Math.max(MIN_SECONDS, Math.min(cap, wanted - total));
    fullPlan.push({ kind: "extend", seconds });
    remaining.push({ kind: "extend", seconds });
    total += seconds;
  }
  return { fullPlan, plan: remaining, cursor, total };
}
function pickResumeOptions(args) {
  const keys = [
    "mode",
    "ratio",
    "generateAudio",
    "watermark",
    "segmentPrompts",
    "transitionDescription",
    "merge",
    // 这几个是 video_extend 的口径（延长方向、提示词写法、整片时间轴位置）
    "direction",
    "wording",
    "startAt",
    "inputVideoSeconds",
    "firstFrameUrl",
    "lastFrameUrl",
    "referenceImages",
    "characterReferenceImages",
    "resolution",
    "seed",
    "user",
    "returnLastFrame"
  ];
  const options = {};
  for (const key of keys) {
    if (args?.[key] !== void 0) options[key] = args[key];
  }
  return options;
}
function pauseRecordAt({ stamp, prompt, fullPlan, done, cursor, lastVideoUrl, options, segments }) {
  return {
    plugin: "metaontic-video",
    kind: "paused-plan",
    version: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    stamp,
    prompt,
    plan: fullPlan,
    done,
    cursor,
    lastVideoUrl,
    options,
    steps: segments.map((segment) => ({
      index: segment.index,
      kind: segment.kind,
      seconds: segment.seconds,
      taskId: segment.taskId,
      videoUrl: segment.videoUrl
    }))
  };
}
function resumeHint(dir, remainingSeconds, toolName = "video_generate") {
  return `\u8981\u63A5\u7740\u505A\u5C31\u628A resume="${dir}" \u518D\u8C03\u4E00\u6B21 ${toolName}\uFF08prompt \u53EF\u4EE5\u7701\u7565\uFF0C\u5176\u4F59\u53C2\u6570\u7167\u65E7\uFF09\uFF1A\u63D2\u4EF6\u4F1A\u63A5\u7740\u5DF2\u7ECF\u751F\u6210\u7684\u5206\u6BB5\u7EE7\u7EED\uFF0C\u5269\u4E0B\u7684 ${remainingSeconds} \u79D2\u4E0D\u7528\u91CD\u5934\u751F\u6210\u3001\u4E0D\u4F1A\u91CD\u590D\u6263\u8D39\u3002`;
}
function progressConnection(config) {
  return {
    provider: isMetaontic(config) ? "metaontic" : isVolcengine(config) ? "volcengine" : "service",
    model: resolveModel(config),
    baseUrl: resolveBaseUrl(config),
    submitPath: resolveSubmitPath(config),
    queryPath: resolveQueryPath(config, "{task_id}")
  };
}
function assertResumeConnection(data, config, args) {
  if (!data?.connection) return;
  if (JSON.stringify(data.connection) === JSON.stringify(progressConnection(config))) return;
  if (data.pendingTask || Object.values(data.operationState || {}).some((state) => state.phase === "converting" || state.phase === "review" || state.retryUsed && !state.retryResult)) throw new Error("\u8FD9\u4EFD\u8FDB\u5EA6\u8FD8\u6709\u5DF2\u63D0\u4EA4\u7684\u4EFB\u52A1\uFF0C\u8BF7\u6062\u590D\u539F\u6A21\u578B\u548C\u63A5\u5165\u6E20\u9053\u540E\u67E5\u8BE2\uFF0C\u4E0D\u80FD\u5207\u6362\u6E20\u9053\u91CD\u590D\u63D0\u4EA4\u3002");
  if (args?.resumeWithCurrentConfig === true) {
    if (data.plan.slice(Number(data.done) || 0).some((step) => step.seconds > modelMaxSeconds(config))) {
      throw new Error("\u539F\u8FDB\u5EA6\u4E2D\u7684\u5206\u6BB5\u8D85\u8FC7\u5F53\u524D\u6A21\u578B\u5355\u6BB5\u4E0A\u9650\uFF0C\u8BF7\u6062\u590D\u539F\u6A21\u578B\u540E\u7EE7\u7EED\uFF0C\u4E0D\u81EA\u52A8\u7F29\u77ED\u5DF2\u5BA1\u6838\u5206\u6BB5\u3002");
    }
    return;
  }
  throw new Error("\u5F53\u524D\u6A21\u578B\u6216\u63A5\u5165\u6E20\u9053\u4E0E\u539F\u8FDB\u5EA6\u4E0D\u4E00\u81F4\u3002\u8BF7\u6062\u590D\u539F\u914D\u7F6E\uFF1B\u5982\u9700\u66F4\u6362\uFF0C\u5148\u5411\u7528\u6237\u8BF4\u660E\u53D8\u5316\u5E76\u786E\u8BA4\uFF0C\u518D\u4F20 resumeWithCurrentConfig:true\u3002");
}
async function saveProgress(dir, { config, toolName, stamp, prompt, fullPlan, cursor, referenceUrl, options, segments, pendingTask, operationState = {}, characterReferences = void 0 }) {
  const completed = segments.filter((step) => step.status === "succeeded" && step.videoUrl);
  const record = pauseRecordAt({
    stamp,
    prompt,
    fullPlan,
    done: completed.length,
    cursor,
    lastVideoUrl: referenceUrl,
    options,
    segments: completed
  });
  Object.assign(record, {
    toolName,
    connection: progressConnection(config),
    deliveryPending: !pendingTask && completed.length > 0,
    state: pendingTask ? "pending" : completed.length >= fullPlan.length ? "completed" : "paused",
    pendingTask: pendingTask || null,
    operationState,
    ...characterReferences !== void 0 ? { characterReferences } : {}
  });
  await writePauseFile(dir, record);
}

// src/utils/json.ts
function toJsonSafe(value, seen = /* @__PURE__ */ new Set()) {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "boolean") return value;
  if (type === "number") {
    return Number.isFinite(value) && !Object.is(value, -0) ? value : String(value);
  }
  if (type === "bigint") return value.toString();
  if (type === "undefined" || type === "function" || type === "symbol") return void 0;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return value.message ? `${value.name}: ${value.message}` : value.name;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from(value, (item) => toJsonSafe(item, seen) ?? null);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return String(value);
    const plain = {};
    for (const [key, item] of Object.entries(value)) {
      const safe = toJsonSafe(item, seen);
      if (safe !== void 0) plain[key] = safe;
    }
    return plain;
  } finally {
    seen.delete(value);
  }
}
function jsonSafeTool(tool) {
  return {
    ...tool,
    async execute(...args) {
      return toJsonSafe(await tool.execute(...args));
    }
  };
}

// src/providers/submissions.ts
import path8 from "node:path";
import { createHash, randomUUID as randomUUID3 } from "node:crypto";
import { mkdir as mkdir5, readFile as readFile3, writeFile as writeFile2, rename as rename3, rm as rm3, open as open3, readdir as readdir2 } from "node:fs/promises";
init_connection();

// src/providers/transport.ts
init_connection();

// src/providers/response.ts
init_config();
function findKey(payload, keys, depth = Infinity) {
  if (payload && typeof payload === "object") {
    if (!Array.isArray(payload)) {
      for (const key of keys) {
        const value = payload[key];
        if (value !== void 0 && value !== null && value !== "") return value;
      }
    }
    if (depth <= 0) return void 0;
    for (const value of Array.isArray(payload) ? payload : Object.values(payload)) {
      const found = findKey(value, keys, depth - 1);
      if (found !== void 0 && found !== null && found !== "") return found;
    }
  }
  return void 0;
}
function collectUrls(payload, path14 = [], found = []) {
  if (typeof payload === "string") {
    if (/^https?:\/\//i.test(payload)) found.push([path14, payload]);
  } else if (Array.isArray(payload)) {
    for (const item of payload) collectUrls(item, path14, found);
  } else if (payload && typeof payload === "object") {
    for (const [key, value] of Object.entries(payload)) {
      collectUrls(value, [...path14, key], found);
    }
  }
  return found;
}
function isImageKey(key) {
  const lowered = String(key || "").toLowerCase();
  return IMAGE_KEY_TOKENS.some((token) => lowered.includes(token));
}
function looksLikeImageUrl(url) {
  return IMAGE_EXTENSIONS.some((ext) => url.split("?")[0].toLowerCase().endsWith(ext));
}
function extractTaskId(payload) {
  const value = findKey(payload, ["id", "task_id", "taskId", "request_id"], 4);
  return typeof value === "string" && value ? value : void 0;
}
function extractVideoUrl(payload) {
  const candidates = collectUrls(payload).filter(
    ([path14, url]) => !looksLikeImageUrl(url) && !path14.some(isImageKey)
  );
  if (!candidates.length) return void 0;
  for (const wanted of VIDEO_URL_KEYS) {
    for (const [path14, url] of candidates) {
      if (path14.length && String(path14.at(-1)).toLowerCase() === wanted) return url;
    }
  }
  for (const [path14, url] of candidates) {
    if (path14.length && GENERIC_URL_KEYS.has(String(path14.at(-1)).toLowerCase())) return url;
  }
  return candidates[0][1];
}
function extractImageUrl(payload) {
  const found = collectUrls(payload).find(
    ([path14, url]) => looksLikeImageUrl(url) || path14.some(isImageKey)
  );
  return found?.[1];
}
function extractStatus(payload) {
  const value = findKey(payload, ["status", "state", "task_status"]);
  return typeof value === "string" ? value.toLowerCase() : void 0;
}

// src/providers/transport.ts
init_config();
var RELAY_TIMEOUT_MS = 12e4;
async function relayRequest(config, requestPath, options = {}) {
  const method = options.method || "GET";
  const requestId = uniqueSuffix("request");
  const started = Date.now();
  const trace = {};
  const body = options.body;
  const operation = method === "POST" ? "create_task" : "query_task";
  const info = {
    requestId,
    operation,
    method,
    provider: isMetaontic(config) ? "metaontic" : isVolcengine(config) ? "volcengine" : "service",
    model: body?.model || resolveModel(config),
    ...method === "POST" ? {
      duration: body?.duration,
      resolution: body?.resolution,
      imageCount: Array.isArray(body?.content) ? body.content.filter((item) => item.type === "image_url").length : 0,
      videoCount: Array.isArray(body?.content) ? body.content.filter((item) => item.type === "video_url").length : 0
    } : { taskId: String(requestPath).split("?")[0].split("/").at(-1) }
  };
  await appendRequestLog({ ...info, event: "request_started" });
  try {
    const data = await relayRequestCore(config, requestPath, options, trace);
    await appendRequestLog({
      ...info,
      ...trace,
      event: "request_completed",
      elapsedMs: Date.now() - started,
      taskId: extractTaskId(data) || info.taskId,
      taskStatus: extractStatus(data),
      completionTokens: finiteNumber(data?.usage?.completion_tokens)
    });
    return data;
  } catch (error) {
    await appendRequestLog({
      ...info,
      ...trace,
      event: "request_failed",
      elapsedMs: Date.now() - started,
      errorCode: String(error?.code || "request_error"),
      cancelled: Boolean(options.signal?.aborted)
    });
    throw error;
  }
}
async function relayRequestCore(config, path14, { method = "GET", body, signal } = {}, trace = {}) {
  const url = `${resolveBaseUrl(config)}${path14}`;
  const timeout = AbortSignal.timeout(RELAY_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const serialized = body === void 0 ? void 0 : JSON.stringify(body);
  if (serialized && Buffer.byteLength(serialized, "utf8") > 64 * 1024 * 1024) {
    throw Object.assign(new Error("\u89C6\u9891\u8BF7\u6C42\u4F53\u8D85\u8FC764 MB\uFF0C\u8BF7\u51CF\u5C11\u5185\u8054\u56FE\u7247\u6216\u6539\u7528\u516C\u7F51 URL\uFF1B\u706B\u5C71\u76F4\u8FDE\u4E5F\u53EF\u4F7F\u7528 asset:// \u7D20\u6750\u3002"), { code: "request_too_large" });
  }
  let response;
  let text;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${resolveApiKey(config)}`,
        "Content-Type": "application/json"
      },
      ...serialized !== void 0 ? { body: serialized } : {},
      signal: requestSignal
    });
    trace.httpStatus = response.status;
    trace.upstreamRequestId = response.headers.get("x-request-id") || response.headers.get("x-tt-logid") || void 0;
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw Object.assign(new Error(`\u4E2D\u8F6C\u7AD9\u8BF7\u6C42\u5931\u8D25\uFF1A${error?.message || error}`), {
      code: "provider_network_error"
    });
  }
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  const upstreamError = data && typeof data === "object" && data.error;
  const failedTaskResponse = method === "GET" && FAILED_STATES.has(extractStatus(data));
  if (!response.ok || upstreamError && !failedTaskResponse) {
    const httpStatus = response.status >= 400 ? response.status : 400;
    const classified = classifyError(
      httpStatus,
      data
    );
    throw Object.assign(new Error(classified.message), {
      code: classified.code,
      status: httpStatus
    });
  }
  return data;
}
function sleep(ms, signal) {
  return new Promise((resolve3, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve3();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function getTask(config, taskId, signal) {
  return relayRequest(config, resolveQueryPath(config, taskId), { signal });
}
async function waitForCompletion(config, taskId, signal) {
  const deadline = Date.now() + ref(config, "maxWaitMs", 6e5);
  const maxPollErrors = Math.max(1, Math.round(ref(config, "pollErrorRetries", 5)));
  let pollErrors = 0;
  for (; ; ) {
    if (signal?.aborted) throw abortError();
    let task;
    try {
      task = await getTask(config, taskId, signal);
      pollErrors = 0;
    } catch (failure) {
      if (failure?.code === "ABORTED") throw failure;
      if (!isRetryablePollError(failure)) {
        return {
          taskId,
          status: "unknown",
          errorCode: failure?.code || "provider_poll_error",
          error: `\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF08${taskId}\uFF09\uFF0C\u67E5\u8BE2\u8FD4\u56DE\u5931\u8D25\uFF1A${failure?.message || failure}\u3002\u53EF\u7528 video_status \u6309\u8FD9\u4E2A ID \u590D\u67E5\u786E\u8BA4\u3002`
        };
      }
      pollErrors += 1;
      if (pollErrors >= maxPollErrors || Date.now() > deadline) {
        return {
          taskId,
          status: "unknown",
          errorCode: failure?.code || "provider_poll_error",
          error: `\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF08${taskId}\uFF09\uFF0C\u4F46\u8FDE\u7EED ${pollErrors} \u6B21\u67E5\u8BE2\u72B6\u6001\u5931\u8D25\uFF1A${failure?.message || failure}\u3002\u4EFB\u52A1\u53EF\u80FD\u4ECD\u5728\u751F\u6210\uFF0C\u53EF\u7528 video_status \u6309\u8FD9\u4E2A ID \u518D\u67E5\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u3002`
        };
      }
      await sleep(ref(config, "pollIntervalMs", 5e3), signal);
      continue;
    }
    const status = extractStatus(task) || "unknown";
    const model = findKey(task, ["model"]) || resolveModel(config);
    if (SUCCESS_STATES.has(status)) {
      const videoUrl = extractVideoUrl(task);
      if (videoUrl) return { taskId, status: "succeeded", model, videoUrl };
      const imageUrl = extractImageUrl(task);
      return {
        taskId,
        status: "failed",
        model,
        errorCode: "provider_bad_response",
        error: imageUrl ? `\u4E0A\u6E38\u8FD4\u56DE\u7684\u662F\u56FE\u7247\u800C\u4E0D\u662F\u89C6\u9891\uFF08${imageUrl.split("?")[0].slice(-60)}\uFF09\uFF0C\u53EF\u80FD\u662F\u4E2D\u8F6C\u7AD9\u628A\u89C6\u9891\u8BF7\u6C42\u8DEF\u7531\u5230\u4E86\u56FE\u7247\u6E20\u9053\u3002` : "\u4E0A\u6E38\u62A5\u544A\u6210\u529F\u4F46\u6CA1\u6709\u8FD4\u56DE\u89C6\u9891\u5730\u5740\u3002"
      };
    }
    if (FAILED_STATES.has(status)) {
      const data = findKey(task, ["error", "fail_reason", "message", "detail"]);
      const classified = classifyError(400, typeof data === "string" ? { message: data } : data || task);
      return {
        taskId,
        status: CANCEL_STATES.has(status) ? "cancelled" : "failed",
        model,
        errorCode: classified.code,
        error: classified.message
      };
    }
    if (Date.now() > deadline) {
      return { taskId, status: "timeout" };
    }
    await sleep(ref(config, "pollIntervalMs", 5e3), signal);
  }
}

// src/providers/submissions.ts
var hash = (value) => createHash("sha256").update(value).digest("hex");
function submissionIdentity(config) {
  return hash(JSON.stringify([isVolcengine(config) ? "volcengine" : isMetaontic(config) ? "metaontic" : "service", resolveBaseUrl(config), hash(resolveApiKey(config))]));
}
function directory() {
  return path8.join(dshHome(), "state", "metaontic-video", "submissions");
}
async function save(file, record) {
  const temporary = `${file}.${randomUUID3()}.tmp`;
  try {
    await writeFile2(temporary, JSON.stringify(record), { mode: 384 });
    await rename3(temporary, file);
  } finally {
    await rm3(temporary, { force: true }).catch(() => {
    });
  }
}
function blocked(record) {
  return Object.assign(new Error(`\u63D0\u4EA4\u7ED3\u679C\u5C1A\u4E0D\u786E\u5B9A\uFF0C\u5DF2\u963B\u6B62\u91CD\u590D\u63D0\u4EA4\u3002\u8BB0\u5F55 ID\uFF1A${record.id}\u3002\u8BF7\u5148\u5728\u6E20\u9053\u8BB0\u5F55\u4E2D\u6838\u5BF9\uFF0C\u518D\u7528 media_submission \u5173\u8054\u539F\u4EFB\u52A1 ID\uFF0C\u6216\u5728\u786E\u8BA4\u672A\u521B\u5EFA\u540E\u89E3\u9501\uFF1B\u4E0D\u8981\u76F4\u63A5\u91CD\u65B0\u751F\u6210\u3002`), { code: "submission_unknown", submissionId: record.id });
}
async function guardedSubmit(config, requestPath, body, signal, scope = "") {
  if (signal?.aborted) throw abortError();
  const identity = submissionIdentity(config);
  const id = hash(JSON.stringify([identity, requestPath, body]));
  await mkdir5(directory(), { recursive: true, mode: 448 });
  const file = path8.join(directory(), `${id}.json`);
  let handle;
  try {
    handle = await open3(file, "wx", 384);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const old = await readSubmission(id);
    if (old.taskId && (!scope || old.scope === scope)) return { task_id: old.taskId, id: old.taskId };
    throw blocked(old);
  }
  const record = { id, identity, requestPath, scope, model: body?.model, status: "submitting", createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  try {
    await handle.writeFile(JSON.stringify(record));
  } finally {
    await handle.close();
  }
  try {
    const result = await relayRequest(config, requestPath, { method: "POST", body, signal });
    const taskId = extractTaskId(result);
    if (!taskId) throw new Error("\u63D0\u4EA4\u54CD\u5E94\u7F3A\u5C11\u4EFB\u52A1 ID");
    record.taskId = taskId;
    record.status = "created";
    await save(file, record);
    return result;
  } catch (error) {
    if (error?.code === "request_too_large") {
      await rm3(file, { force: true });
      throw error;
    }
    if (error?.status >= 400 && error.status < 500 && error.status !== 408) {
      await rm3(file, { force: true });
      throw error;
    }
    record.status = "uncertain";
    await save(file, record).catch(() => {
    });
    throw blocked(record);
  }
}
async function finishSubmission(config, requestPath, body) {
  const id = hash(JSON.stringify([submissionIdentity(config), requestPath, body]));
  await rm3(path8.join(directory(), `${id}.json`), { force: true });
}
async function finishKnownTask(config, taskId) {
  const identity = submissionIdentity(config);
  for (const name of await readdir2(directory()).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  })) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
    const file = path8.join(directory(), name);
    const raw = await readFile3(file, "utf8").catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (raw === null) continue;
    const record = JSON.parse(raw);
    if (record.identity === identity && record.taskId === taskId && record.status === "created") await rm3(file, { force: true });
  }
}
async function readSubmission(id) {
  if (!/^[a-f0-9]{64}$/.test(String(id))) throw new Error("\u63D0\u4EA4\u8BB0\u5F55 ID \u683C\u5F0F\u4E0D\u6B63\u786E\u3002");
  const record = JSON.parse(await readFile3(path8.join(directory(), `${id}.json`), "utf8"));
  if (record.id !== id) throw new Error("\u63D0\u4EA4\u8BB0\u5F55\u635F\u574F\uFF0C\u5DF2\u505C\u6B62\u3002");
  return record;
}
async function reconcileSubmission(config, id, taskId, confirmedNotCreated) {
  const record = await readSubmission(id);
  if (/\/tasks\/doubao$/.test(record.requestPath)) config = imageConfig(config);
  if (record.identity !== submissionIdentity(config)) throw new Error("\u8BF7\u6062\u590D\u539F\u63A5\u5165\u65B9\u5F0F\u3001\u5730\u5740\u548C Key \u540E\u6838\u5BF9\u63D0\u4EA4\u3002");
  const file = path8.join(directory(), `${id}.json`);
  if (record.status === "submitting" && Date.now() - Date.parse(record.createdAt) < 15e4) throw new Error("\u539F\u63D0\u4EA4\u4ECD\u53EF\u80FD\u6B63\u5728\u6267\u884C\uFF0C\u8BF7\u7B49\u5F85\u5176\u8FD4\u56DE\u540E\u518D\u6838\u5BF9\u3002");
  if (taskId) {
    const image = /\/tasks\/doubao$/.test(record.requestPath);
    const queryPath = image ? record.requestPath.replace(/\/doubao$/, "") + "/" + encodeURIComponent(taskId) : (await Promise.resolve().then(() => (init_connection(), connection_exports))).resolveQueryPath(config, taskId);
    await relayRequest(config, queryPath);
    record.taskId = taskId;
    record.status = "created";
    await save(file, record);
    return { submissionId: id, taskId, status: "linked" };
  }
  if (record.taskId) throw new Error("\u6B64\u8BB0\u5F55\u5DF2\u6709\u660E\u786E\u4EFB\u52A1 ID\uFF0C\u8BF7\u5148\u67E5\u8BE2\u539F\u4EFB\u52A1\uFF0C\u4E0D\u80FD\u6309\u672A\u521B\u5EFA\u89E3\u9501\u3002");
  if (confirmedNotCreated !== true) throw new Error("\u5FC5\u987B\u63D0\u4F9B\u539F\u4EFB\u52A1 ID\uFF0C\u6216\u7531\u7528\u6237\u5728\u6E20\u9053\u4FA7\u6838\u5BF9\u5E76\u660E\u786E\u786E\u8BA4\u672A\u521B\u5EFA\u3002");
  await rm3(file);
  return { submissionId: id, status: "unlocked", note: "\u4EC5\u89E3\u9664\u672C\u673A\u9632\u91CD\uFF0C\u672A\u63D0\u4EA4\u65B0\u4EFB\u52A1\uFF1B\u4E0B\u4E00\u6B21\u751F\u6210\u4ECD\u9700\u8D39\u7528\u786E\u8BA4\u3002" };
}

// src/tools/media-submission.ts
init_connection();
function submissionTool(liveConfig) {
  return {
    name: "media_submission",
    description: "\u6838\u5BF9\u56FE\u7247/\u89C6\u9891\u63D0\u4EA4\u7ED3\u679C\u4E0D\u660E\u7684\u9632\u91CD\u8BB0\u5F55\u3002get \u8BFB\u53D6\uFF1Breconcile \u5173\u8054\u7528\u6237\u4ECE\u6E20\u9053\u8BB0\u5F55\u627E\u5230\u7684\u539F taskId\uFF0C\u6216\u7528\u6237\u786E\u8BA4\u6E20\u9053\u672A\u521B\u5EFA\u540E\u7528 confirmedNotCreated:true \u89E3\u9501\u3002\u4E0D\u5F97\u731C\u4EFB\u52A1 ID \u6216\u672A\u7ECF\u7528\u6237\u6838\u5BF9\u5C31\u89E3\u9501\uFF1B\u672C\u5DE5\u5177\u4E0D\u521B\u5EFA\u4ED8\u8D39\u4EFB\u52A1\u3002",
    parameters: { type: "object", properties: {
      action: { type: "string", enum: ["get", "reconcile"] },
      submissionId: { type: "string" },
      taskId: { type: "string" },
      confirmedNotCreated: { type: "boolean" }
    }, required: ["action", "submissionId"] },
    output: { schema: { type: "object", properties: { status: { type: "string" }, submissionId: { type: "string" }, taskId: { type: "string" }, note: { type: "string" } } }, render(_args, value) {
      return [{ type: "text", text: JSON.stringify(value) }];
    } },
    timeoutMs: 15e4,
    isConcurrencySafe() {
      return false;
    },
    async execute(args) {
      const config = snapshotConfig(liveConfig);
      if (args?.action === "get") {
        const record = await readSubmission(args.submissionId);
        if (record.identity !== submissionIdentity(/\/tasks\/doubao$/.test(record.requestPath) ? imageConfig(config) : config)) throw new Error("\u8BF7\u6062\u590D\u539F\u8FDE\u63A5\u548C Key \u540E\u6838\u5BF9\u3002");
        return { submissionId: record.id, status: record.status, taskId: record.taskId, model: record.model, createdAt: record.createdAt };
      }
      if (args?.action !== "reconcile") throw new Error("\u672A\u77E5\u64CD\u4F5C\u3002");
      return reconcileSubmission(config, args.submissionId, String(args?.taskId || "").trim(), args?.confirmedNotCreated);
    }
  };
}

// src/tools/results.ts
import { resolve as resolve2 } from "node:path";
function previewInstruction(value) {
  const latest = (value?.segments || []).filter((segment) => segment.status === "succeeded").at(-1);
  const target = latest?.localPath || value?.videoPath || latest?.videoUrl || value?.videoUrl;
  return `\u3010\u4E0B\u4E00\u6B65\uFF1A\u5148\u5C55\u793A\u89C6\u9891\uFF0C\u7B49\u5F85\u7528\u6237\u9884\u89C8\u3011\u8BF7\u7ACB\u5373\u4F7F\u7528\u5F53\u524D\u5BBF\u4E3B\u7684 present/\u6587\u4EF6\u5C55\u793A\u5DE5\u5177\u5C55\u793A\u672C\u6B21\u5B8C\u6210\u7684\u5206\u6BB5\uFF1A${target || "\u89C1\u672C\u6B21\u5206\u6BB5\u7ED3\u679C"}\u3002\u6B63\u6587\u9644\u4E0A ${artifactLink("\u89C2\u770B\u672C\u6BB5\u89C6\u9891", latest?.localPath || value?.previewPath || value?.videoPath, latest?.videoUrl || value?.videoUrl)}\u3002\u4E0D\u80FD\u53EA\u8BF4\u201C\u751F\u6210\u6210\u529F\u201D\u6216\u53EA\u5217\u4EFB\u52A1ID\u3002\u5C55\u793A\u540E\u8BE2\u95EE\u201C\u5148\u770B\u8FD9\u6BB5\uFF0C\u6548\u679C\u53EF\u4EE5\u5417\uFF1F\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u4E0B\u4E00\u6BB5\u3002\u201D\u5E76\u7ED3\u675F\u672C\u8F6E\u7B49\u5F85\u56DE\u590D\u3002\u7528\u6237\u9996\u6B21\u6388\u6743\u5236\u4F5C\u4E0D\u7B49\u4E8E\u5DF2\u770B\u8FC7\u672C\u6BB5\uFF0C\u4E0D\u5F97\u81EA\u52A8resume\u6216\u8C03\u7528\u5176\u4ED6\u751F\u6210\u5DE5\u5177\u7ED5\u8FC7\u9884\u89C8\uFF1B\u5C55\u793A\u5DE5\u5177\u4E0D\u53EF\u7528\u65F6\u7ED9\u51FA\u53EF\u70B9\u51FB\u89C6\u9891\u8DEF\u5F84\u6216\u64AD\u653E\u94FE\u63A5\uFF0C\u4ECD\u987B\u7B49\u5F85\u660E\u786E\u786E\u8BA4\u3002`;
}
function artifactLink(label, localPath, videoUrl) {
  const target = localPath ? resolve2(localPath) : videoUrl;
  if (!target) return "";
  return `[${label}](<${String(target).replace(/</g, "%3C").replace(/>/g, "%3E")}>)`;
}
function deliveryInstruction(value) {
  const segments = value?.segments || [];
  const completed = segments.filter((segment) => segment.status === "succeeded" && (segment.localPath || segment.videoUrl));
  const multiPart = segments.length > 1 || value?.paused && (value?.remainingSeconds || 0) > 0;
  if (!completed.length && !value?.videoPath && !value?.videoUrl) return "";
  const linkRule = "\u8BF7\u4F7F\u7528 present/\u6587\u4EF6\u5C55\u793A\u5DE5\u5177\u767B\u8BB0\u5B9E\u9645\u89C6\u9891\u6587\u4EF6\uFF0C\u5E76\u5728\u7528\u6237\u53EF\u89C1\u6B63\u6587\u4E2D\u59CB\u7EC8\u9010\u9879\u9644\u4E0A Markdown \u53EF\u70B9\u51FB\u94FE\u63A5\uFF1A[\u89C2\u770B\u89C6\u9891](<\u7EDD\u5BF9\u6587\u4EF6\u8DEF\u5F84\u6216\u771F\u5B9E\u64AD\u653EURL>)\u3002\u4E0D\u80FD\u7528\u53CD\u5F15\u53F7\u8DEF\u5F84\u6216\u666E\u901A\u6587\u672C\u8DEF\u5F84\u4EE3\u66FF\u94FE\u63A5\uFF1Bpresent\u6210\u529F\u4E5F\u4E0D\u80FD\u7701\u7565\u6B63\u6587\u94FE\u63A5\u3002\u5361\u7247\u672A\u9A8C\u8BC1\u65F6\u4E0D\u5F97\u58F0\u79F0\u4E0A\u65B9\u5361\u7247\u53EF\u76F4\u63A5\u64AD\u653E\u3002\u5DF2\u6709\u6587\u4EF6\u76F4\u63A5\u4EA4\u4ED8\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u3002";
  if (!multiPart) {
    const segment = completed[0];
    return ["\u3010\u89C6\u9891\u4EA4\u4ED8\uFF1A\u6B63\u6587\u5FC5\u987B\u6709\u53EF\u70B9\u51FB\u94FE\u63A5\u3011", artifactLink("\u89C2\u770B\u89C6\u9891", value.videoPath || segment?.localPath, segment?.videoUrl || value.videoUrl), linkRule].join("\n");
  }
  const labels = ["\u7B2C\u4E00\u6BB5", "\u7B2C\u4E8C\u6BB5", "\u7B2C\u4E09\u6BB5"];
  const items = completed.map((segment, i) => {
    const index = segment.index || i + 1;
    const label = labels[index - 1] || `\u7B2C${index}\u6BB5`;
    return `${label}\uFF1A${segment.localPath || segment.videoUrl}
${artifactLink(label, segment.localPath, segment.videoUrl)}`;
  });
  const mergedPath = completed.length > 1 && value?.merged && value?.videoPath && !completed.some((segment) => segment.localPath === value.videoPath) ? value.videoPath : "";
  if (mergedPath) items.unshift(artifactLink("\u6253\u5F00\u5408\u5E76\u89C6\u9891", mergedPath, ""), `${value.paused || value.partial || value.status !== "succeeded" ? "\u5DF2\u5B8C\u6210\u90E8\u5206\u5408\u5E76\u89C6\u9891" : "\u5408\u5E76\u540E\u5B8C\u6574\u89C6\u9891"}\uFF1A${mergedPath}`);
  else if (completed.length > 1) items.push("\u5408\u5E76\u7ED3\u679C\u5C1A\u672A\u4EA4\u4ED8\uFF1A\u5982\u5B9E\u8BF4\u660E\u672A\u5408\u5E76\u3001\u5408\u5E76\u5931\u8D25\u6216\u7B49\u5F85\u4EA4\u4ED8\uFF0C\u4E0D\u5C06\u6700\u540E\u4E00\u6BB5\u5F53\u4F5C\u5B8C\u6574\u6210\u7247\u3002");
  return [
    "\u3010\u4EA4\u4ED8\u6E05\u5355\uFF1A\u6BCF\u4E2A\u5206\u6BB5\u4E0E\u5408\u5E76\u7ED3\u679C\u5206\u522B\u5C55\u793A\u3011",
    ...items,
    linkRule,
    "\u8BF7\u5B9E\u9645\u4F7F\u7528 present/\u6587\u4EF6\u5C55\u793A\u5DE5\u5177\uFF0C\u5148\u5C55\u793A\u5408\u5E76\u6210\u7247\uFF0C\u518D\u6309\u6BB5\u53F7\u4F9D\u6B21\u5C55\u793A\u5404\u5206\u6BB5\uFF1B\u6CA1\u6709\u5408\u5E76\u7ED3\u679C\u65F6\u53EA\u6309\u6BB5\u53F7\u5C55\u793A\u5206\u6BB5\u3002\u6BCF\u9879\u6807\u660E\u5BF9\u5E94\u6BB5\u53F7\u6216\u5408\u5E76\u7ED3\u679C\uFF0C\u4E0D\u53EA\u5C55\u793A\u6700\u540E\u4E00\u6BB5\u6216\u5408\u5E76\u89C6\u9891\u3002\u5C55\u793A\u5DE5\u5177\u4E0D\u53EF\u7528\u65F6\uFF0C\u4E3A\u6BCF\u9879\u63D0\u4F9B\u53EF\u70B9\u51FB\u6587\u4EF6\u8DEF\u5F84\u6216\u64AD\u653E\u94FE\u63A5\u3002\u5DF2\u6709\u6587\u4EF6\u76F4\u63A5\u4EA4\u4ED8\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u3002present \u7684 files \u6570\u7EC4\u7B2C\u4E00\u4E2A\u5FC5\u987B\u662F\u5408\u5E76\u6210\u7247\uFF0C\u5176\u540E\u624D\u6309\u6BB5\u53F7\u653E\u5206\u6BB5\uFF1B\u987A\u5E8F\u4E0D\u5BF9\u6216\u6F0F\u6389\u6210\u7247\u7684 present \u4F1A\u88AB\u63D2\u4EF6\u62E6\u4E0B\uFF0C\u6309\u63D0\u793A\u628A\u6210\u7247\u632A\u5230\u7B2C\u4E00\u4E2A\u91CD\u53D1\u5373\u53EF\uFF0C\u4E0D\u5F97\u56E0\u6B64\u7701\u7565\u6210\u7247\u6216\u5206\u6BB5\u3002"
  ].join("\n");
}
function recoveryInstruction(value, toolName) {
  if (!value?.resumeDir) return "";
  if (value.deliveryError || value.ffmpegMissing) return `\u751F\u6210\u8FDB\u5EA6\u5DF2\u4FDD\u5B58\u3002\u4EA4\u4ED8\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u7528 ${toolName} \u7684 resume="${value.resumeDir}" \u91CD\u8BD5\u4E0B\u8F7D\u6216\u5408\u5E76\uFF0C\u4E0D\u4F1A\u91CD\u65B0\u751F\u6210\u6216\u91CD\u590D\u6263\u8D39\u3002`;
  if (value.pendingTaskId) return `\u4EFB\u52A1 ${value.pendingTaskId} \u5DF2\u63D0\u4EA4\u3002\u8BF7\u7528 ${toolName} \u7684 resume="${value.resumeDir}" \u67E5\u8BE2\u5E76\u63A5\u56DE\u539F\u8FDB\u5EA6\uFF0C\u4E0D\u4F1A\u91CD\u65B0\u63D0\u4EA4\u672C\u6BB5\u3002`;
  return "";
}
function referenceReview(value, toolName) {
  return [{ type: "text", text: [
    "\u3010\u4E0B\u4E00\u6B65\uFF1A\u5C55\u793A\u8F6C\u6362\u56FE\u7247\u5E76\u7B49\u5F85\u7528\u6237\u786E\u8BA4\uFF0C\u5C1A\u672A\u91CD\u8BD5\u89C6\u9891\u3011",
    ...(value.convertedReferences || []).map((item, index) => `\u56FE\u7247${index + 1}\uFF08${item.role}\uFF09\uFF1A${artifactLink(`\u6253\u5F00\u56FE\u7247${index + 1}`, item.localPath, item.imageUrl)}`),
    `\u5148\u4F7F\u7528 present/\u56FE\u7247\u5C55\u793A\u5DE5\u5177\u9010\u5F20\u5C55\u793A\uFF0C\u5E76\u5728\u6B63\u6587\u9010\u5F20\u5185\u5D4C\u56FE\u7247\u53CA\u9644\u53EF\u70B9\u51FB\u539F\u56FE\u94FE\u63A5\uFF1B\u5361\u7247\u6210\u529F\u4E0D\u80FD\u7701\u7565\u6B63\u6587\u94FE\u63A5\u3002\u786E\u8BA4\u662F\u975E\u771F\u4EBA\u4E14\u7B26\u5408\u98CE\u683C\u8981\u6C42\uFF1B\u7528\u6237\u660E\u786E\u540C\u610F\u540E\u518D\u8C03\u7528 ${toolName}\uFF0C\u4F20 resume="${value.resumeDir}"\u3001referenceImagesReviewed:true\u3002\u9996\u6B21\u8F6C\u6362\u6388\u6743\u4E0D\u7B49\u4E8E\u7ED3\u679C\u786E\u8BA4\u3002\u56FE\u7247\u4ECD\u50CF\u771F\u4EBA\u6216\u4E0D\u6EE1\u610F\u65F6\u505C\u6B62\uFF0C\u4E0D\u81EA\u52A8\u518D\u6B21\u51FA\u56FE\u3002\u89C6\u9891\u91CD\u8BD5\u53E6\u5916\u8BA1\u8D39\u3002`
  ].join("\n") }];
}
function renderResult(value) {
  if (value?.status === "review_required") return referenceReview(value, "video_extend");
  const {
    status,
    segments = [],
    videoUrl,
    error,
    videoPath,
    mergeMode,
    segmentsDir,
    paused,
    resumeDir,
    remainingSeconds,
    note
  } = value || {};
  const lines = segments.map((segment) => {
    const head = `\u7B2C ${segment.index} \u6BB5\uFF1A+${segment.seconds}s\uFF08\u4EFB\u52A1 ${segment.taskId}\uFF09`;
    if (segment.status !== "succeeded" || !segment.videoUrl) {
      return `${head} \u2192 ${segment.status}${segment.error ? `\uFF1A${segment.error}` : ""}`;
    }
    return segment.localPath ? `${head} \u2192 ${segment.videoUrl}
    \u672C\u5730\u6587\u4EF6\uFF1A${segment.localPath}` : `${head} \u2192 ${segment.videoUrl}`;
  });
  if (status === "succeeded") {
    const parts = [deliveryInstruction(value), recoveryInstruction(value, "video_extend")];
    if (paused) {
      parts.push(previewInstruction(value));
      parts.push(
        `\u5DF2\u5EF6\u957F\u5E76\u4EA4\u4ED8\u524D ${segments.length} \u6BB5\uFF08\u5171 ${formatSeconds(segments.reduce(
          (sum, item) => sum + (item.seconds || 0),
          0
        ))} \u79D2\uFF09\uFF1A\u6BCF\u6BB5\u5EF6\u957F\u5B8C\u90FD\u4F1A\u95EE\u4E00\u6B21\u8981\u4E0D\u8981\u7EE7\u7EED\uFF1B\u8FD9\u6B21\u5148\u4EA4\u4ED8\u5230\u8FD9\u91CC\uFF08\u5F53\u524D\u6682\u505C\u7B49\u5F85\u9884\u89C8\u786E\u8BA4\uFF1B\u4E5F\u53EF\u80FD\u56E0\u505C\u6B62\u6216\u8D85\u65F6\u6682\u505C\uFF09\u3002`
      );
    } else {
      parts.push("\u89C6\u9891\u5EF6\u957F\u6210\u529F\u3002");
    }
    parts.push(...lines);
    if (videoPath) parts.push(`\u6210\u7247\uFF08\u672C\u5730\u6587\u4EF6\uFF09\uFF1A${videoPath}\uFF08${mergeModeLabel(mergeMode)}\uFF09`);
    if (paused && resumeDir) {
      parts.push(
        `\u8FD8\u6CA1\u751F\u6210\u7684\u90E8\u5206\uFF1A\u8FD8\u5269 ${formatSeconds(remainingSeconds)} \u79D2\u3002\u8981\u63A5\u7740\u505A\u5C31\u628A resume="${resumeDir}" \u4F20\u56DE video_extend\uFF08prompt \u53EF\u4EE5\u7701\u7565\uFF0C\u5176\u4F59\u53C2\u6570\u7167\u65E7\uFF09\uFF1A\u524D\u9762\u51E0\u6BB5\u4E0D\u4F1A\u91CD\u65B0\u751F\u6210\u3001\u4E0D\u4F1A\u91CD\u590D\u6263\u8D39\u3002`
      );
    }
    parts.push(`\u6700\u540E\u4E00\u6BB5\u4E0A\u6E38\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1A${videoUrl || "\uFF08\u65E0\uFF09"}`);
    if (note) parts.push(note);
    return [{ type: "text", text: parts.filter(Boolean).join("\n") }];
  }
  if (status === "timeout") {
    return [
      {
        type: "text",
        text: [
          deliveryInstruction(value),
          "\u5EF6\u957F\u4EFB\u52A1\u4ECD\u5728\u751F\u6210\u4E2D\uFF08\u5DF2\u8D85\u51FA\u5355\u6B21\u7B49\u5F85\u65F6\u95F4\uFF09\u3002",
          recoveryInstruction(value, "video_extend"),
          ...lines,
          `\u53EF\u7528 video_status \u67E5\u8BE2\u4EFB\u52A1 ${segments.at(-1)?.taskId || "\uFF08\u672A\u77E5\uFF09"} \u7684\u72B6\u6001\u4E0E\u89C6\u9891\u94FE\u63A5\u3002`
        ].join("\n")
      }
    ];
  }
  if (status === "unknown") {
    return [
      {
        type: "text",
        text: [
          deliveryInstruction(value),
          recoveryInstruction(value, "video_extend"),
          "\u6CA1\u80FD\u786E\u8BA4\u8FD9\u6BB5\u5EF6\u957F\u4EFB\u52A1\u7684\u72B6\u6001\uFF08\u67E5\u8BE2\u5931\u8D25\uFF0C\u4E0D\u662F\u4EFB\u52A1\u5931\u8D25\uFF09\u3002\u4EFB\u52A1\u5DF2\u7ECF\u63D0\u4EA4\uFF0C\u53EF\u80FD\u4ECD\u5728\u751F\u6210\uFF1B\u7528 video_status \u6309\u4EFB\u52A1 ID \u590D\u67E5\uFF0C\u4E0D\u8981\u91CD\u65B0\u63D0\u4EA4\u3002",
          ...lines,
          `\u53EF\u7528 video_status \u67E5\u8BE2\u4EFB\u52A1 ${segments.at(-1)?.taskId || "\uFF08\u672A\u77E5\uFF09"} \u7684\u72B6\u6001\u4E0E\u89C6\u9891\u94FE\u63A5\u3002`
        ].join("\n")
      }
    ];
  }
  if (status === "cancelled") {
    return [{ type: "text", text: [deliveryInstruction(value), `\u5EF6\u957F\u4EFB\u52A1\u5DF2\u53D6\u6D88\u3002
${lines.join("\n")}`].filter(Boolean).join("\n") }];
  }
  return [
    {
      type: "text",
      text: [
        deliveryInstruction(value),
        `\u89C6\u9891\u5EF6\u957F\u5931\u8D25${error ? `\uFF1A${error}` : ""}\u3002`,
        ...lines,
        videoUrl ? `\u5DF2\u5B8C\u6210\u90E8\u5206\u7684\u89C6\u9891\u94FE\u63A5\uFF1A${videoUrl}` : ""
      ].filter(Boolean).join("\n")
    }
  ];
}
var SEGMENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    index: { type: "integer" },
    kind: { type: "string" },
    seconds: { type: "integer" },
    taskId: { type: "string" },
    status: { type: "string" },
    videoUrl: { type: "string" },
    localPath: { type: "string" },
    durationSeconds: { type: "number" },
    error: { type: "string" }
  }
};
var VIDEO_SEGMENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    index: { type: "integer" },
    kind: { type: "string" },
    seconds: { type: "integer" },
    taskId: { type: "string" },
    status: { type: "string" },
    videoUrl: { type: "string" },
    localPath: { type: "string" },
    durationSeconds: { type: "number" },
    error: { type: "string" }
  }
};
function mergeModeLabel(mergeMode) {
  if (mergeMode === "copy") return "\u65E0\u635F\u62FC\u63A5";
  if (mergeMode === "segment") return "\u8FD9\u4E00\u6BB5\u6682\u65F6\u6309\u539F\u59CB\u5206\u6BB5\u4EA4\u4ED8\uFF08\u7EED\u505A\u65F6\u518D\u548C\u540E\u9762\u7684\u6BB5\u5408\u5E76\uFF09";
  if (mergeMode === "single") return "\u4E00\u6BB5\u76F4\u51FA\uFF0C\u65E0\u9700\u62FC\u63A5";
  if (mergeMode === "seamless") return "\u76F4\u63A5\u62FC\u63A5\uFF08\u65E7\u914D\u7F6E\u517C\u5BB9\uFF09";
  return "\u91CD\u7F16\u7801\u62FC\u63A5";
}
function renderVideoResult(value) {
  if (value?.status === "review_required") return referenceReview(value, "video_generate");
  const {
    status,
    mode,
    segments = [],
    videoUrl,
    videoPath,
    mergeMode,
    segmentsDir,
    note,
    error,
    pendingTaskId,
    paused,
    resumeDir,
    remainingSeconds
  } = value || {};
  const lines = segments.map((segment) => {
    const label = segment.kind === "extend" ? `\u5EF6\u957F +${segment.seconds}s` : `\u76F4\u51FA ${segment.seconds}s`;
    const head = `\u7B2C ${segment.index} \u6BB5\uFF1A${label}\uFF08\u4EFB\u52A1 ${segment.taskId}\uFF09`;
    if (segment.status !== "succeeded" || !segment.videoUrl) {
      return `${head} \u2192 ${segment.status}${segment.error ? `\uFF1A${segment.error}` : ""}`;
    }
    return segment.localPath ? `${head} \u2192 ${segment.videoUrl}
    \u672C\u5730\u6587\u4EF6\uFF1A${segment.localPath}` : `${head} \u2192 ${segment.videoUrl}`;
  });
  const parts = [deliveryInstruction(value), recoveryInstruction(value, "video_generate"), ...paused ? [previewInstruction(value)] : []];
  if (status === "succeeded") {
    if (paused) {
      parts.push(
        `\u5DF2\u751F\u6210\u5E76\u4EA4\u4ED8\u524D ${segments.length} \u6BB5\uFF08\u5171 ${formatSeconds(segments.length ? segments.reduce((sum, item) => sum + (item.seconds || 0), 0) : 0)} \u79D2\uFF09\uFF1A\u6BCF\u6BB5\u751F\u6210\u5B8C\u90FD\u4F1A\u95EE\u4E00\u6B21\u8981\u4E0D\u8981\u7EE7\u7EED\uFF1B\u8FD9\u6B21\u5148\u4EA4\u4ED8\u5230\u8FD9\u91CC\uFF08\u5F53\u524D\u6682\u505C\u7B49\u5F85\u9884\u89C8\u786E\u8BA4\uFF1B\u4E5F\u53EF\u80FD\u56E0\u505C\u6B62\u6216\u8D85\u65F6\u6682\u505C\uFF09\u3002`
      );
    } else if (mode === "extended") {
      parts.push(`\u89C6\u9891\u751F\u6210\u6210\u529F\uFF1A\u5148\u76F4\u51FA ${formatSeconds(segments[0]?.seconds)} \u79D2\uFF0C\u518D\u5EF6\u957F ${segments.length - 1} \u6BB5\u3002`);
    } else {
      parts.push(`\u89C6\u9891\u751F\u6210\u6210\u529F\uFF1A\u4E00\u6B21\u76F4\u51FA ${formatSeconds(segments[0]?.seconds)} \u79D2\uFF0C\u6CA1\u6709\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\uFF0C\u4E0D\u9700\u8981\u5EF6\u957F\u3002`);
    }
  } else if (status === "timeout") {
    parts.push("\u4EFB\u52A1\u4ECD\u5728\u751F\u6210\u4E2D\uFF08\u5DF2\u8D85\u51FA\u5355\u6B21\u7B49\u5F85\u65F6\u95F4\uFF09\u3002");
  } else if (status === "unknown") {
    parts.push(
      "\u6CA1\u80FD\u786E\u8BA4\u4EFB\u52A1\u72B6\u6001\uFF08\u67E5\u8BE2\u5931\u8D25\uFF0C\u4E0D\u662F\u4EFB\u52A1\u5931\u8D25\uFF09\u3002\u4EFB\u52A1\u5DF2\u7ECF\u63D0\u4EA4\uFF0C\u53EF\u80FD\u4ECD\u5728\u751F\u6210\uFF1B\u7528 video_status \u6309\u4E0B\u9762\u7684\u4EFB\u52A1 ID \u590D\u67E5\uFF0C\u4E0D\u8981\u91CD\u65B0\u63D0\u4EA4\u3002"
    );
  } else if (status === "cancelled") {
    parts.push("\u4EFB\u52A1\u5DF2\u53D6\u6D88\u3002");
  } else {
    parts.push(`\u89C6\u9891\u751F\u6210\u5931\u8D25${error ? `\uFF1A${error}` : ""}\u3002`);
  }
  if (status === "succeeded") {
    if (videoPath) {
      parts.push(`\u6210\u7247\uFF08\u672C\u5730\u6587\u4EF6\uFF09\uFF1A${videoPath}\uFF08${mergeModeLabel(mergeMode)}\uFF09`);
    } else if (segmentsDir) {
      parts.push(`\u6CA1\u6709\u5408\u5E76\u6210\u4E00\u6761\uFF1A\u5206\u6BB5\u6587\u4EF6\u90FD\u5728 ${segmentsDir}\uFF08\u6BCF\u6BB5\u8DEF\u5F84\u89C1\u4E0B\u9762\u7684\u5217\u8868\uFF09\u3002`);
    } else {
      parts.push("\u6CA1\u6709\u751F\u6210\u5408\u5E76\u6587\u4EF6\uFF0C\u8BF7\u6309\u4E0A\u9762\u7684\u4E0A\u6E38\u94FE\u63A5\u81EA\u884C\u4E0B\u8F7D\u5206\u6BB5\u3002");
    }
  }
  parts.push(...lines);
  if (paused && resumeDir) {
    parts.push(
      `\u8FD8\u6CA1\u751F\u6210\u7684\u90E8\u5206\uFF1A\u8FD8\u5269 ${formatSeconds(remainingSeconds)} \u79D2\u3002\u8981\u63A5\u7740\u505A\u5C31\u628A resume \u539F\u6837\u4F20\u56DE video_generate\uFF08resume="${resumeDir}"\uFF09\uFF0C\u63D2\u4EF6\u4F1A\u63A5\u7740\u5DF2\u6709\u7684\u5206\u6BB5\u5F80\u4E0B\u751F\u6210\uFF0C\u524D\u9762\u51E0\u6BB5\u4E0D\u4F1A\u91CD\u65B0\u751F\u6210\u3001\u4E5F\u4E0D\u4F1A\u91CD\u590D\u6263\u8D39\u3002`
    );
  }
  if (videoUrl) parts.push(`\u6700\u540E\u4E00\u6BB5\u4E0A\u6E38\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1A${videoUrl}`);
  if (note) parts.push(note);
  if (status === "timeout" || status === "unknown") {
    const taskId = pendingTaskId || segments.at(-1)?.taskId || "\uFF08\u672A\u77E5\uFF09";
    parts.push(`\u53EF\u7528 video_status \u67E5\u8BE2\u4EFB\u52A1 ${taskId} \u7684\u72B6\u6001\u4E0E\u89C6\u9891\u94FE\u63A5\u3002`);
  }
  return [{ type: "text", text: parts.filter(Boolean).join("\n") }];
}

// src/tools/video-prepare-image.ts
init_config();
init_connection();

// src/providers/seedream.ts
init_config();
init_connection();
init_connection();
async function generateSeedreamImageCore(liveConfig, body, signal, existingTaskId, progress = {}) {
  const config = imageConfig(liveConfig);
  const prefix = /\/v1$/i.test(resolveBaseUrl(config)) ? "" : "/v1";
  let taskId = String(existingTaskId || "").trim();
  if (!taskId) {
    const submitted = await guardedSubmit(config, `${prefix}/tasks/doubao`, body, signal, progress.scope);
    taskId = String(submitted?.task_id || submitted?.id || "").trim();
    if (!taskId) throw new Error("\u56FE\u7247\u63D0\u4EA4\u54CD\u5E94\u7F3A\u5C11 task_id\uFF0C\u65E0\u6CD5\u786E\u8BA4\u662F\u5426\u521B\u5EFA\u6210\u529F\uFF1B\u8BF7\u68C0\u67E5\u8C03\u7528\u8BB0\u5F55\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u3002");
  }
  await progress.onCreated?.(taskId);
  const taskPath = `${prefix}/tasks/${encodeURIComponent(taskId)}`;
  const timeoutMs = Math.max(1e3, Number(ref(config, "imageMaxWaitMs", 3e5)) || 3e5);
  const deadline = Date.now() + timeoutMs;
  const budgetSignal = AbortSignal.timeout(timeoutMs);
  const waitSignal = signal ? AbortSignal.any([signal, budgetSignal]) : budgetSignal;
  try {
    for (; ; ) {
      const task = await relayRequest(config, taskPath, { signal: waitSignal });
      const status = String(task?.status || "").toLowerCase();
      if (FAILED_STATES.has(status)) {
        if (body) await finishSubmission(config, `${prefix}/tasks/doubao`, body);
        else await finishKnownTask(config, taskId);
        throw Object.assign(new Error(`\u56FE\u7247\u751F\u6210\u5931\u8D25\uFF1A${task?.fail_reason || task?.error?.message || status}`), { terminal: true });
      }
      if (SUCCESS_STATES.has(status)) break;
      if (Date.now() >= deadline) throw new Error("\u56FE\u7247\u751F\u6210\u7B49\u5F85\u8D85\u65F6");
      await sleep(Math.min(3e3, deadline - Date.now()), waitSignal);
    }
    const result = await relayRequest(config, `${taskPath}/artifacts`, { signal: waitSignal });
    const item = (result?.artifacts || []).find((item2) => /image/i.test(String(item2?.type || "")) && /^https?:\/\//i.test(String(item2?.content_url || "")));
    if (!item) throw new Error("\u4EFB\u52A1\u5DF2\u5B8C\u6210\u4F46\u6CA1\u6709\u53EF\u7528\u56FE\u7247\u4EA7\u7269");
    const completed = { imageUrl: String(item.content_url), taskId };
    await progress.onCompleted?.(completed);
    if (progress.onCompleted) {
      if (body) await finishSubmission(config, `${prefix}/tasks/doubao`, body);
      else await finishKnownTask(config, taskId);
    }
    return completed;
  } catch (error) {
    throw Object.assign(new Error(`${error?.message || error}\uFF08\u56FE\u7247 task_id=${taskId}\uFF09\u3002${error?.terminal ? "\u4EFB\u52A1\u5DF2\u5931\u8D25\uFF0C\u672A\u91CD\u8BD5\u3002" : "\u5DF2\u505C\u6B62\u7B49\u5F85\uFF0C\u4E0D\u91CD\u590D\u63D0\u4EA4\uFF1B\u53EF\u7528 video_prepare_image \u7684 taskId \u67E5\u8BE2\u6B64\u56FE\u7247\u4EFB\u52A1\u3002"}`), { taskId, terminal: Boolean(error?.terminal), code: error?.code || "image_task_error" });
  }
}
async function generateSeedreamImage(...args) {
  return timedStage(args[3] ? "image_task_query" : args[1]?.image ? "image_conversion" : "character_image_generation", () => generateSeedreamImageCore(...args));
}

// src/tools/video-prepare-image.ts
var IMAGE_MODELS = ["doubao-seedream-5-0-260128", "doubao-seedream-5-0-pro-260628"];
function prepareImageTool(liveConfig, progress = {}) {
  return {
    name: "video_prepare_image",
    description: "A/B \u6A21\u5F0F\uFF1ASeedream\u652F\u6301operation=create_character\u6309\u6587\u5B57\u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE\uFF08\u4E0D\u9700\u8981\u539F\u56FE\uFF09\uFF0C\u6216\u9ED8\u8BA4convert_reference\u628A\u771F\u4EBA\u53C2\u8003\u56FE\u8F6C\u4E3A\u975E\u771F\u4EBA\u89D2\u8272\u3002\u7EAF\u6587\u751F\u89C6\u9891\u5148\u8BE2\u95EE\u662F\u5426\u51FA\u89D2\u8272\u56FE\uFF0C\u660E\u786E\u56FE\u7247\u5355\u72EC\u8BA1\u8D39\uFF1B\u540C\u610F\u540E\u751F\u6210\uFF0C\u9010\u5F20\u5C55\u793A\u5E76\u5BA1\u6838\u540E\u624D\u80FD\u7528\u4E8E\u89C6\u9891\u3002\u987B\u5148\u8BF4\u660E\u56FE\u7247\u8C03\u7528\u5355\u72EC\u8BA1\u8D39\u5E76\u786E\u8BA4\u98CE\u683C\uFF1B\u8FD4\u56DE imageUrl\uFF0C\u53EF\u4EA4\u7ED9 video_generate/video_extend \u7684\u53C2\u8003\u56FE\u6216\u9996\u5C3E\u5E27\u3002\u4E0D\u80FD\u8BC6\u522B\u56FE\u7247\u662F\u5426\u771F\u4EBA\uFF0C\u7531\u52A9\u624B\u770B\u56FE\u6216\u6839\u636E\u7528\u6237\u8BF4\u660E\u5224\u65AD\uFF1B\u5931\u8D25\u7981\u6B62\u6539\u7528\u539F\u771F\u4EBA\u56FE\u751F\u6210\u89C6\u9891\u3002",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["convert_reference", "create_character"], description: "\u9ED8\u8BA4convert_reference\u8F6C\u6362\u5DF2\u6709\u56FE\uFF1Bcreate_character\u6839\u636E\u5DF2\u786E\u8BA4\u7684\u4EBA\u7269\u8BBE\u5B9A\u4E0E\u98CE\u683C\u6587\u751F\u89D2\u8272\u56FE\uFF0C\u4E0D\u9700\u8981image\u3002" },
        prompt: { type: "string", description: "create_character\u5FC5\u586B\uFF1A\u5DF2\u5BA1\u6838\u7684\u4EBA\u7269/\u4E3B\u4F53\u5916\u5F62\u3001\u670D\u9970\u4E0E\u7A33\u5B9A\u7279\u5F81\uFF0C\u4E0D\u586B\u89C6\u9891\u52A8\u4F5C\u5267\u60C5\u6216\u5BF9\u767D\u3002" },
        taskId: { type: "string", description: "\u67E5\u8BE2\u5DF2\u63D0\u4EA4\u56FE\u7247\u4EFB\u52A1\u5E76\u53D6\u4EF6\uFF0C\u4E0D\u91CD\u65B0\u63D0\u4EA4\u6216\u6263\u53D6\u65B0\u7684\u751F\u6210\u8D39\u7528\uFF1B\u586B\u5199\u65F6\u65E0\u9700 image/style\u3002" },
        seed: { type: "integer", description: "\u53EF\u9009\u968F\u673A\u79CD\u5B50\u3002\u7528\u6237\u8981\u6C42\u91CD\u65B0\u51FA\u56FE\u65F6\u4F7F\u7528\u4E0D\u540C seed \u5E76\u786E\u8BA4\u8D39\u7528\uFF1B\u76F8\u540C\u53C2\u6570\u7684\u91CD\u590D\u8C03\u7528\u4F1A\u590D\u7528\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u3002" },
        image: { type: "string", description: "convert_reference\u4F7F\u7528\u7684\u539F\u56FE\u516C\u7F51URL\u3001base64\u3001\u672C\u673A\u8DEF\u5F84\u6216latest\uFF1Bcreate_character\u4E0D\u586B\u3002" },
        characterType: { type: "string", enum: ["realistic", "stylized"], description: "\u4EC5create_character\uFF1Arealistic\u771F\u4EBA\u5199\u5B9E\uFF08\u98CE\u683C\u9009\u9879\u7B2C\u4E00\u4F4D\uFF09\uFF0Cstylized\u975E\u771F\u4EBA\u52A8\u753B/\u63D2\u753B\u3002\u987B\u7528\u6237\u660E\u786E\u9009\u62E9\uFF1B\u672A\u6307\u5B9A\u6CBF\u7528stylized\u3002convert_reference\u53EA\u5141\u8BB8stylized\u3002" },
        style: { type: "string", description: "\u5DF2\u4E0E\u7528\u6237\u786E\u5B9A\u7684\u753B\u9762\u98CE\u683C\u3002\u6309\u771F\u4EBA\u5199\u5B9E\u3001\u4E8C\u7EF4\u52A8\u753B\u3001\u5361\u901A\u3001\u63D2\u753B\u987A\u5E8F\u5C55\u793A\u5EFA\u8BAE\uFF1B\u771F\u4EBA\u5199\u5B9E\u540C\u65F6\u8BBE\u7F6EcharacterType=realistic\uFF0C\u8F6C\u6362\u64CD\u4F5C\u5FC5\u987B\u975E\u771F\u4EBA\u3002" }
      },
      required: []
    },
    output: {
      schema: { type: "object", properties: { taskId: { type: "string" }, imageUrl: { type: "string" }, model: { type: "string" }, reviewRequired: { type: "boolean" } } },
      render(_args, value) {
        return [{ type: "text", text: `\u89D2\u8272\u53C2\u8003\u56FE\uFF1A${artifactLink("\u6253\u5F00\u53C2\u8003\u56FE", "", value.imageUrl)}
\u56FE\u7247\u6A21\u578B\uFF1A${value.model}
\u8BF7\u5728\u6B63\u6587\u5185\u5D4C\u56FE\u7247\u5E76\u4FDD\u7559\u53EF\u70B9\u51FB\u539F\u56FE\u94FE\u63A5\uFF0C\u518D\u6838\u5BF9\u98CE\u683C\u4E0E\u89D2\u8272\uFF1B\u6709present\u5361\u7247\u4E5F\u4E0D\u80FD\u7701\u7565\u94FE\u63A5\u3002\u660E\u786E\u786E\u8BA4\u540E\u518D\u7528\u4E8E\u89C6\u9891\uFF0C\u4E0D\u81EA\u52A8\u91CD\u753B\u3002` }];
      }
    },
    timeoutMs: 48e4,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const config = imageConfig(liveConfig);
      if (isVolcengine(config)) throw new Error("\u89D2\u8272\u56FE\u751F\u6210\u4E0E\u53C2\u8003\u56FE\u5904\u7406\u76EE\u524D\u652F\u6301\u670D\u52A1\u7AEF\u6216MetaOntic AI\u63A5\u5165\uFF1B\u706B\u5C71\u76F4\u8FDE\u6682\u4E0D\u63D0\u4F9B\u6B64\u56FE\u7247\u901A\u9053\uFF0C\u53EF\u4F7F\u7528\u5DF2\u51C6\u5907\u597D\u7684\u89D2\u8272\u53C2\u8003\u56FE\u3002");
      assertConfigured(config, resolveApiKey(config));
      const model = String(ref(config, "imageModel", IMAGE_MODELS[0]));
      if (!IMAGE_MODELS.includes(model)) throw new Error("\u8BF7\u9009\u62E9\u53D7\u652F\u6301\u7684 Seedream \u56FE\u7247\u6A21\u578B\u3002");
      if (args?.taskId !== void 0 && !String(args.taskId).trim()) throw new Error("\u56FE\u7247 taskId \u4E0D\u80FD\u4E3A\u7A7A\u767D\u3002");
      if (args?.taskId) {
        const result2 = await generateSeedreamImage(config, void 0, exec?.signal, String(args.taskId).trim(), progress);
        return { ...result2, model, reviewRequired: true };
      }
      const operation = args?.operation || "convert_reference";
      if (!["convert_reference", "create_character"].includes(operation)) throw new Error("\u4E0D\u652F\u6301\u7684\u56FE\u7247\u64CD\u4F5C\u3002");
      const style = String(args?.style || "").trim();
      if (!style) throw new Error("\u8BF7\u5148\u786E\u5B9A\u753B\u9762\u98CE\u683C\u3002");
      const characterType = args?.characterType ?? "stylized";
      if (!["realistic", "stylized"].includes(characterType)) throw new Error("\u4E0D\u652F\u6301\u7684\u89D2\u8272\u98CE\u683C\u7C7B\u578B\u3002");
      if (operation === "convert_reference" && characterType !== "stylized") throw new Error("\u771F\u4EBA\u9650\u5236\u8F6C\u6362\u5FC5\u987B\u4F7F\u7528\u975E\u771F\u4EBA\u98CE\u683C\uFF0C\u4E0D\u80FD\u8F6C\u6362\u4E3A\u771F\u4EBA\u5199\u5B9E\u3002");
      if (args?.seed !== void 0 && !Number.isSafeInteger(args.seed)) throw new Error("seed \u5FC5\u987B\u662F\u5B89\u5168\u6574\u6570\u3002");
      let input;
      let prompt;
      if (operation === "create_character") {
        const character = String(args?.prompt || "").trim();
        if (!character) throw new Error("\u8BF7\u5148\u786E\u8BA4\u89D2\u8272\u5916\u5F62\u8BBE\u5B9A\uFF0C\u518D\u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE\u3002");
        if (args?.image) throw new Error("\u6587\u751F\u89D2\u8272\u56FE\u4E0D\u9700\u8981\u539F\u56FE\uFF1B\u5DF2\u6709\u56FE\u7247\u8BF7\u4F7F\u7528\u8F6C\u6362\u64CD\u4F5C\u3002");
        const appearance = characterType === "realistic" ? "\u91C7\u7528\u771F\u4EBA\u5199\u5B9E\u6444\u5F71\u98CE\u683C\uFF0C\u81EA\u7136\u7684\u76AE\u80A4\u7EB9\u7406\u3001\u771F\u5B9E\u7684\u4EBA\u4F53\u6BD4\u4F8B\u4E0E\u67D4\u548C\u5149\u5F71\uFF0C\u4E0D\u4F7F\u7528\u5361\u901A\u3001\u63D2\u753B\u6216\u52A8\u753B\u9020\u578B\u3002" : "\u91C7\u7528\u660E\u663E\u7684\u975E\u771F\u4EBA\u63D2\u753B\u6216\u52A8\u753B\u9020\u578B\uFF0C\u4E0D\u8981\u8F93\u51FA\u6444\u5F71\u6216\u770B\u8D77\u6765\u4ECD\u662F\u771F\u4EBA\u7684\u7167\u7247\u3002";
        prompt = `\u751F\u6210\u4E00\u5F20\u89D2\u8272\u53C2\u8003\u56FE\u3002\u89D2\u8272\u8BBE\u5B9A\uFF1A${character}\u3002\u5DF2\u786E\u8BA4\u98CE\u683C\uFF1A${style}\u3002${appearance}\u6E05\u6670\u5448\u73B0\u89D2\u8272\u7684\u8138\u90E8\u3001\u53D1\u578B\u3001\u670D\u88C5\u53CA\u4F53\u578B\u7279\u5F81\uFF1B\u753B\u9762\u4EC5\u4E00\u4F4D\u5BF9\u5E94\u89D2\u8272\uFF0C\u80CC\u666F\u7B80\u6D01\uFF0C\u4E0D\u753B\u4EBA\u7269\u591A\u89C6\u56FE\u62FC\u56FE\u3001\u5206\u8EAB\u6216\u989D\u5916\u4EBA\u7269\uFF0C\u4E0D\u6DFB\u52A0\u6587\u5B57\u3001\u5B57\u5E55\u3001Logo\u6216\u6C34\u5370\u3002`;
      } else {
        input = await resolveImageInput(args?.image, "\u771F\u4EBA\u53C2\u8003\u56FE");
        prompt = `\u5C06\u53C2\u8003\u7167\u7247\u4E2D\u7684\u771F\u4EBA\u8F6C\u6362\u4E3A\u660E\u663E\u7684\u975E\u771F\u4EBA\u827A\u672F\u89D2\u8272\uFF0C\u98CE\u683C\uFF1A${style}\u3002\u4FDD\u7559\u670D\u88C5\u3001\u53D1\u578B\u3001\u59FF\u6001\u3001\u6784\u56FE\u548C\u573A\u666F\u5173\u7CFB\uFF0C\u4F7F\u7528\u6E05\u6670\u7684\u7ED8\u753B\u6216\u52A8\u753B\u6750\u8D28\u4E0E\u9020\u578B\uFF0C\u4E0D\u8981\u8F93\u51FA\u6444\u5F71\u3001\u5199\u5B9E\u76AE\u80A4\u6216\u770B\u8D77\u6765\u4ECD\u662F\u771F\u4EBA\u7167\u7247\u7684\u753B\u9762\u3002\u4E0D\u6DFB\u52A0\u6587\u5B57\u3002`;
      }
      const result = await generateSeedreamImage(config, {
        ...args?.seed !== void 0 ? { seed: args.seed } : {},
        model,
        ...input ? { image: [input.url] } : {},
        size: "2048x2048",
        n: 1,
        response_format: "url",
        watermark: false,
        prompt
      }, exec?.signal, void 0, progress);
      return { ...result, model, reviewRequired: true };
    }
  };
}

// src/workflow/character-references.ts
init_connection();
init_config();
async function initialCharacterReferences(config, args, saved, signal) {
  if (Array.isArray(saved?.characterReferences)) {
    validateImageRoles({ referenceImages: saved.characterReferences.map((item) => item?.image_url?.url) }, resolveModel(config));
    return saved.characterReferences.map((item) => ({ ...item, image_url: { ...item.image_url } }));
  }
  const referenceImages = Array.isArray(args.referenceImages) ? args.referenceImages : args.referenceImages ? [args.referenceImages] : [];
  const source = args.characterReferenceImages ?? (referenceImages.length ? referenceImages : args.firstFrameUrl ? [args.firstFrameUrl] : []);
  const { refs } = validateImageRoles({ referenceImages: source }, resolveModel(config));
  const canvas = canvasSize(args.ratio || ref(config, "ratio", "adaptive"));
  const fit = canvas ? { size: canvas, config, signal } : null;
  const images = [];
  for (const value of refs) {
    const resolved = isVolcengine(config) && /^asset:\/\//.test(value) ? { url: value } : await resolveImageInput(value, "\u6700\u521D\u89D2\u8272\u53C2\u8003\u56FE", fit);
    images.push({ type: "image_url", image_url: { url: resolved.url }, role: "reference_image" });
  }
  return images;
}
function approvedCharacterReferences(images, state) {
  if (!state?.retryUsed || state.retryResult?.status !== "succeeded" || !state.convertedBody) return images;
  const original = state.originalBody?.content || [];
  const converted = state.convertedBody.content || [];
  return images.map((image) => {
    const index = original.findIndex((item) => item.type === "image_url" && item.image_url?.url === image.image_url?.url);
    const replacement = converted[index];
    return index >= 0 && replacement?.type === "image_url" ? { ...image, image_url: { url: replacement.image_url.url } } : image;
  });
}

// src/tools/video-generate.ts
init_config();
init_connection();

// src/prompts/generation.ts
init_config();
init_connection();
var SPEECH_EXECUTION = "\u3010\u5BF9\u767D\u6267\u884C\u3011\u4EC5\u5728\u672C\u6BB5\u5DF2\u6307\u5B9A\u5BF9\u767D\u65F6\u53D1\u58F0\uFF0C\u6309\u6307\u5B9A\u8BED\u8A00\u3001\u8BF4\u8BDD\u4EBA\u548C\u5148\u540E\u987A\u5E8F\u6E05\u6670\u81EA\u7136\u5730\u8BF4\u51FA\u672C\u6BB5\u53F0\u8BCD\uFF1B\u4E00\u4EBA\u8BF4\u5B8C\u53E6\u4E00\u4EBA\u518D\u63A5\uFF0C\u4E0D\u62A2\u8BDD\u3001\u4E0D\u4E32\u53F0\u3002\u53F0\u8BCD\u4EE5{}\u3001\u97F3\u6548\u4EE5<>\u3001\u97F3\u4E50\u4EE5()\u533A\u5206\uFF1B\u5982\u6709\u53D1\u97F3\u6587\u672C\u6620\u5C04\uFF0C{}\u5185\u4E3A\u5B9E\u9645\u6717\u8BFB\u6587\u672C\uFF0C\u5C55\u793A\u539F\u6587\u53EA\u7528\u4E8E\u5DF2\u8981\u6C42\u7684\u5B57\u5E55\uFF0C\u4E0D\u628A\u6620\u5C04\u8BF4\u660E\u8BFB\u51FA\u6765\u3002\u6BCF\u53E5\u5B8C\u6574\u8BF4\u5B8C\uFF0C\u4FDD\u7559\u53E5\u5185\u505C\u987F\u3001\u4EBA\u7269\u53CD\u5E94\u53CA\u7ED3\u5C3E\u7559\u767D\uFF0C\u4E0D\u4E3A\u8D76\u65F6\u957F\u52A0\u901F\u3001\u541E\u5B57\u6216\u622A\u65AD\uFF0C\u4E0D\u590D\u8FF0\u4E0A\u4E00\u6BB5\u3002\u65E0\u5BF9\u767D\u65F6\u4E0D\u65B0\u589E\u4EBA\u58F0\uFF1B\u672A\u8981\u6C42\u5B57\u5E55\u65F6\u4E0D\u751F\u6210\u5B57\u5E55\u3002";
function buildExtensionPrompt({
  prompt,
  seconds,
  startAt,
  mode,
  transitionDescription,
  direction = "backward",
  wording = "extend"
}) {
  const forward = direction === "forward";
  if (transitionDescription !== void 0 && typeof transitionDescription !== "string") throw new Error("\u8FC7\u6E21\u63CF\u8FF0\u5FC5\u987B\u662F\u6587\u5B57\u3002");
  const embedded = String(prompt || "").match(/【过渡画面】([^\r\n]*)/)?.[1]?.trim();
  const explicitTransition = embedded || String(transitionDescription || "").trim();
  const plotPrompt = String(prompt || "").replace(/【过渡画面】[^\r\n]*/g, "").trim();
  const transitionText = explicitTransition || (forward ? "\u672C\u6BB5\u672B\u5C3E\u7684\u52A8\u4F5C\u3001\u89C6\u7EBF\u548C\u58F0\u97F3\u9010\u6B65\u8FDB\u5165\u89C6\u98911\u5F00\u5934\u7684\u72B6\u6001\uFF0C\u4FDD\u6301\u53D9\u4E8B\u8FDE\u7EED\uFF0C\u4E0D\u590D\u5236\u89C6\u98911\u5DF2\u53D1\u751F\u7684\u5185\u5BB9\u3002" : mode === "closeup" ? "\u627F\u63A5\u89C6\u98911\u672B\u5C3E\u7684\u72B6\u6001\uFF0C\u5728\u5B8C\u6574\u5BF9\u767D\u6216\u52A8\u4F5C\u7ED3\u675F\u540E\u6309\u672C\u6BB5\u811A\u672C\u5207\u6362\u666F\u522B\uFF1B\u672A\u6307\u5B9A\u65F6\u5207\u5230\u542C\u8005\u7684\u8FD1\u666F\u53CD\u5E94\uFF0C\u518D\u63A8\u8FDB\u65B0\u5267\u60C5\uFF0C\u4FDD\u6301\u8F74\u7EBF\u3001\u4EBA\u7269\u5173\u7CFB\u548C\u58F0\u97F3\u8FDE\u7EED\u3002" : "\u627F\u63A5\u89C6\u98911\u672B\u5C3E\u4EBA\u7269\u7684\u52A8\u4F5C\u9636\u6BB5\u548C\u89C6\u7EBF\uFF0C\u540C\u673A\u4F4D\u987A\u52BF\u8FDB\u5165\u672C\u6BB5\u65B0\u52A8\u4F5C\uFF0C\u73AF\u5883\u58F0\u4E0E\u914D\u4E50\u81EA\u7136\u5EF6\u7EED\uFF0C\u4E0D\u91CD\u590D\u4E0A\u4E00\u6BB5\u52A8\u4F5C\u6216\u53F0\u8BCD\u3002");
  const plannedCut = Boolean(explicitTransition) || !forward && mode === "closeup";
  const head = forward ? "\u5411\u524D\u5EF6\u957F\u89C6\u98911\u3002" : wording === "after" ? "\u751F\u6210\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF1A" : "\u5411\u540E\u5EF6\u957F\u89C6\u98911\u3002";
  const span = forward ? startAt == null ? `\u751F\u6210 ${seconds} \u79D2\u524D\u7F6E\u753B\u9762\uFF0C\u63A5\u5728\u89C6\u98911\u7B2C\u4E00\u5E27\u4E4B\u524D\u3002` : `\u751F\u6210 ${seconds} \u79D2\u524D\u7F6E\u753B\u9762\uFF0C\u5BF9\u5E94\u6574\u7247\u7B2C ${Math.max(0, startAt - seconds)}\u2013${startAt} \u79D2\uFF0C\u7D27\u63A5\u5728\u89C6\u98911\u4E4B\u524D\u3002` : startAt == null ? `\u751F\u6210 ${seconds} \u79D2\u7EED\u62CD\u753B\u9762\uFF0C\u63A5\u5728\u89C6\u98911\u6700\u540E\u4E00\u5E27\u4E4B\u540E\u3002` : `\u751F\u6210 ${seconds} \u79D2\u7EED\u62CD\u753B\u9762\uFF0C\u5BF9\u5E94\u6574\u7247\u7B2C ${startAt}\u2013${startAt + seconds} \u79D2\uFF0C\u63A5\u5728\u89C6\u98911\u4E4B\u540E\u3002`;
  const transition = explicitTransition ? "\u6309\u5DF2\u5BA1\u6838\u7684\u8FC7\u6E21\u753B\u9762\u63CF\u8FF0\u6267\u884C\u63A5\u7F1D\uFF1B\u53EA\u6709\u63CF\u8FF0\u660E\u786E\u5B89\u6392\u5207\u955C\u3001\u666F\u522B\u6216\u573A\u666F\u53D8\u5316\u65F6\u624D\u6539\u53D8\uFF0C\u4E0D\u64C5\u81EA\u6362\u4EBA\u3001\u6362\u88C5\u3001\u91CD\u65B0\u5F00\u573A\u6216\u91CD\u590D\u5DF2\u5B8C\u6210\u52A8\u4F5C\u3002" : forward ? FORWARD_TRANSITION : mode === "closeup" ? CLOSEUP_TRANSITION : CONTINUOUS_TRANSITION;
  return [
    `${head}${span}`,
    `\u3010\u5EF6\u957F\u65B9\u5411\u3011${forward ? "\u5411\u524D\u5EF6\u957F\uFF08\u524D\u7F6E\u5267\u60C5\uFF0C\u653E\u5728\u89C6\u98911\u4E4B\u524D\uFF09" : "\u5411\u540E\u5EF6\u957F\uFF08\u7EED\u62CD\u5267\u60C5\uFF0C\u63A5\u5728\u89C6\u98911\u4E4B\u540E\uFF09"}\u3002`,
    `\u3010\u5267\u60C5\u53D1\u5C55\u3011${endWithPunctuation(plotPrompt)}${forward ? "\u53EA\u6F14\u89C6\u98911\u4E4B\u524D\u53D1\u751F\u7684\u524D\u7F6E\u5267\u60C5\uFF0C\u4E0D\u590D\u8FF0\u89C6\u98911\u91CC\u7684\u60C5\u8282\u3002" : "\u53EA\u6F14\u89C6\u98911\u4E4B\u540E\u53D1\u751F\u7684\u65B0\u5267\u60C5\uFF0C\u4E0D\u91CD\u590D\u89C6\u98911\u91CC\u7684\u60C5\u8282\u3001\u4E0D\u91CD\u65B0\u5F00\u573A\u3002"}`,
    `\u3010\u8FC7\u6E21\u753B\u9762\u3011${transitionText}`,
    "\u3010\u6267\u884C\u8981\u7D20\u3011\u6309\u672C\u6BB5\u5DF2\u5BA1\u6838\u7684\u4E3B\u4F53\u3001\u52A8\u4F5C\u7EC6\u8282\u3001\u573A\u666F\u73AF\u5883\u3001\u5149\u5F71\u8272\u8C03\u3001\u955C\u5934\u8FD0\u955C\u3001\u89C6\u89C9\u98CE\u683C\u3001\u753B\u8D28\u4E0E\u7EA6\u675F\u6267\u884C\uFF1B\u672A\u8981\u6C42\u6539\u53D8\u7684\u5185\u5BB9\u6CBF\u7528\u89C6\u98911\uFF0C\u4E0D\u51ED\u7A7A\u589E\u52A0\u89D2\u8272\u3001\u9053\u5177\u6216\u7279\u6548\u3002",
    "\u3010\u4E3B\u4F53\u72B6\u6001\u3011" + (forward ? "\u672C\u6BB5\u6536\u5C3E\u7684\u4EBA\u7269\u9762\u8C8C\u3001\u4F53\u578B\u3001\u670D\u88C5\u3001\u59FF\u6001\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\u5FC5\u987B\u80FD\u76F4\u63A5\u63A5\u5230\u89C6\u98911\u7B2C\u4E00\u5E27\uFF1B" : "\u6CBF\u7528\u89C6\u98911\u7ED3\u5C3E\u7684\u4EBA\u7269\u9762\u8C8C\u3001\u4F53\u578B\u3001\u670D\u88C5\u3001\u59FF\u6001\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\uFF1B") + "\u540C\u4E00\u89D2\u8272\u4FDD\u6301\u97F3\u8272\u3001\u53E3\u97F3\u3001\u8BED\u901F\u548C\u5F53\u524D\u60C5\u7EEA\uFF0C\u4E0D\u6362\u4EBA\u3001\u4E0D\u6362\u88C5\uFF0C\u4E0D\u6539\u53D8\u5E74\u9F84\u4E0E\u5916\u8C8C\u7279\u5F81\u3002",
    plannedCut ? "\u3010\u955C\u5934\u8FD0\u52A8\u3011\u6309\u8FC7\u6E21\u753B\u9762\u63CF\u8FF0\u4E0E\u672C\u6BB5\u5DF2\u5BA1\u6838\u811A\u672C\u786E\u5B9A\u63A5\u7F1D\u7684\u673A\u4F4D\u3001\u666F\u522B\u548C\u8FD0\u955C\uFF1B\u660E\u786E\u5207\u955C\u65F6\u5141\u8BB8\u6539\u53D8\u666F\u522B\u4E0E\u673A\u4F4D\uFF0C\u4E0D\u518D\u5F3A\u5236\u63A5\u7F1D\u524D\u540E\u6784\u56FE\u3001\u7126\u6BB5\u5B8C\u5168\u76F8\u540C\u3002\u672A\u5B89\u6392\u5207\u955C\u65F6\u987A\u63A5\u539F\u955C\u5934\u8FD0\u52A8\u3002\u573A\u666F\u3001\u66DD\u5149\u3001\u767D\u5E73\u8861\u4E0E\u5149\u6E90\u53D8\u5316\u5FC5\u987B\u6709\u811A\u672C\u4F9D\u636E\uFF0C\u4E0D\u81EA\u884C\u538B\u6697\u3001\u504F\u8272\u6216\u91CD\u5EFA\u80CC\u666F\u3002" : "\u3010\u955C\u5934\u8FD0\u52A8\u3011\u5728\u63A5\u7F1D\u5904\u5339\u914D\u89C6\u98911" + (forward ? "\u5F00\u5934\u7684" : "\u7ED3\u5C3E\u7684") + "\u673A\u4F4D\u3001\u666F\u522B\u3001\u7126\u6BB5\u3001\u8FD0\u955C\u65B9\u5411\u4E0E\u901F\u5EA6\uFF1B\u63A5\u7F1D\u4E4B\u5916\u6309\u672C\u6BB5\u811A\u672C\u81EA\u7136\u8FD0\u955C\u6216\u5207\u955C\u3002\u4FDD\u6301\u66DD\u5149\u3001\u767D\u5E73\u8861\u3001\u5149\u6E90\u65B9\u5411\u548C\u573A\u666F\u5E03\u5C40\u8FDE\u8D2F\uFF0C\u6574\u6BB5\u4EAE\u5EA6\u4E0E\u8272\u8C03\u5FC5\u987B\u4E0E\u89C6\u98911" + (forward ? "\u5F00\u5934" : "\u7ED3\u5C3E") + "\u4E00\u81F4\uFF0C\u4E0D\u8981\u6574\u4F53\u538B\u6697\u6216\u504F\u8272\u3002",
    "\u3010\u58F0\u97F3\u5EF6\u7EED\u3011" + (forward ? "\u672C\u6BB5\u58F0\u97F3\u5728\u7ED3\u5C3E\u81EA\u7136\u8854\u63A5\u89C6\u98911\u5F00\u5934\uFF0C\u53F0\u8BCD\u53EA\u8BB2\u524D\u7F6E\u5267\u60C5\u3002" : "\u672C\u6BB5\u58F0\u97F3\u63A5\u7EED\u89C6\u98911\u7ED3\u5C3E\uFF0C\u53F0\u8BCD\u53EA\u8BB2\u540E\u7EED\u5267\u60C5\u3002") + "\u4FDD\u6301\u89D2\u8272\u97F3\u8272\u4E00\u81F4\uFF0C\u73AF\u5883\u58F0\u6309\u5DF2\u5BA1\u6838\u8FC7\u6E21\u81EA\u7136\u5EF6\u7EED\u6216\u4EA4\u63A5\uFF1B\u6CA1\u6709\u573A\u666F\u53D8\u5316\u65F6\u4FDD\u6301\u5E95\u566A\u4E00\u81F4\u3002\u6BCF\u53E5\u53F0\u8BCD\u5B8C\u6574\u8BF4\u5B8C\uFF0C\u4E0D\u590D\u8FF0\u539F\u53F0\u8BCD\u3002\u539F\u89C6\u9891\u6709\u914D\u4E50\u65F6\u4FDD\u6301\u66F2\u76EE\u4E0E\u8282\u594F\u8FDE\u8D2F\uFF1B\u539F\u89C6\u9891\u65E0\u914D\u4E50\u65F6\u4E0D\u65B0\u589E\u914D\u4E50\u3002",
    forward ? "\u3010\u8F93\u51FA\u8FB9\u754C\u3011\u4EC5\u8F93\u51FA\u65B0\u589E\u524D\u7F6E\u7247\u6BB5\uFF1B\u539F\u89C6\u9891\u5F00\u5934\u53EA\u7528\u4E8E\u8854\u63A5\uFF0C\u4E0D\u590D\u5236\u539F\u89C6\u9891\u753B\u9762\u6216\u5DF2\u51FA\u73B0\u7684\u53F0\u8BCD\u3002" : "\u3010\u8F93\u51FA\u8FB9\u754C\u3011\u4EC5\u8F93\u51FA\u65B0\u589E\u7EED\u62CD\u7247\u6BB5\uFF1B\u89C6\u98911\u672B\u5C3E\u53EA\u7528\u4E8E\u7406\u89E3\u5F53\u524D\u72B6\u6001\uFF0C\u4E0D\u628A\u672B\u5C3E\u51E0\u79D2\u518D\u6B21\u8F93\u51FA\u3002\u8D77\u59CB\u5373\u63A8\u8FDB\u4E0B\u4E00\u52A8\u4F5C\uFF0C\u4E0D\u91CD\u505A\u62FF\u8D77\u3001\u653E\u4E0B\u3001\u9012\u624B\u673A\u7B49\u5DF2\u5B8C\u6210\u52A8\u4F5C\uFF1B\u4E0D\u91CD\u590D\u4E0A\u4E00\u53E5\u5BF9\u767D\u6216\u5176\u5C3E\u97F3\u3002",
    SPEECH_EXECUTION,
    transition,
    "\u672C\u6BB5\u660E\u786E\u6307\u5B9A\u7684\u8FD0\u955C\u548C\u5207\u955C\u4F18\u5148\uFF0C\u4E0A\u9762\u7684\u8854\u63A5\u5EFA\u8BAE\u4E0D\u5F97\u8986\u76D6\u5DF2\u786E\u8BA4\u7684\u955C\u5934\u5B89\u6392\u3002"
  ].join("\n");
}
function buildSegmentExecutionPrompt({ prompt, kind, index, count }) {
  const boundary = kind === "generate" ? "\u8FD9\u662F\u9996\u6BB5\uFF1A\u53EA\u6F14\u672C\u6BB5\u4E8B\u4EF6\uFF0C\u7ED3\u5C3E\u505C\u5728\u672C\u6BB5\u6307\u5B9A\u72B6\u6001\uFF0C\u4E0D\u62A2\u6F14\u540E\u6BB5\u5267\u60C5\uFF0C\u4E0D\u505A\u6574\u7247\u7ED3\u675F\u5F0F\u6536\u5C3E\u3002" : "\u8FD9\u662F\u7EED\u62CD\u6BB5\uFF1A\u89C6\u98911\u63D0\u4F9B\u4E0A\u4E00\u6BB5\u7ED3\u675F\u72B6\u6001\uFF0C\u4ECE\u5176\u540E\u7684\u65B0\u4E8B\u4EF6\u7EE7\u7EED\u3002\u4E0D\u8981\u91CD\u6F14\u8FDB\u573A\u3001\u9012\u63A5\u7269\u54C1\u6216\u5DF2\u8BF4\u53F0\u8BCD\u3002";
  return [
    `\u3010\u751F\u6210\u6BB5 ${index + 1}/${count}\u3011\u751F\u6210\u6BB5\u7F16\u53F7\u4E0D\u662F\u5207\u955C\u6307\u4EE4\uFF1B\u955C\u5934\u662F\u5426\u5207\u6362\u4EE5\u811A\u672C\u4E3A\u51C6\u3002`,
    "\u3010\u6267\u884C\u5185\u5BB9\u3011" + String(prompt).trim(),
    boundary,
    index < count - 1 ? "\u5728\u5B8C\u6574\u53E5\u7ED3\u675F\u3001\u52A8\u4F5C\u5B8C\u6210\u6216\u81EA\u7136\u53CD\u5E94\u5904\u4EA4\u63A5\uFF0C\u4FDD\u7559\u4EBA\u7269\u4F4D\u7F6E\u3001\u89C6\u7EBF\u3001\u6301\u7269\u624B\u548C\u955C\u5934\u8FD0\u52A8\u72B6\u6001\uFF0C\u4E0D\u7528\u5B9A\u683C\u7B49\u5F85\u586B\u6EE1\u65F6\u957F\u3002" : "\u5B8C\u6210\u672C\u6BB5\u7684\u6545\u4E8B\u53D8\u5316\uFF0C\u518D\u7528\u81EA\u7136\u53CD\u5E94\u6216\u753B\u9762\u6536\u675F\uFF1B\u4E0D\u91CD\u8FF0\u524D\u60C5\u3002"
  ].join("\n");
}
function buildGenerationPrompt({ prompt, seconds, model = "" }) {
  const timing = isOmniExtendModel(model) ? "\u6309\u672C\u6BB5\u4E8B\u4EF6\u987A\u5E8F\u63A8\u8FDB\uFF1B\u5982\u6709\u65F6\u95F4\u533A\u95F4\uFF0C\u4EE5\u672C\u6BB50\u79D2\u4E3A\u8D77\u70B9\uFF0C\u533A\u95F4\u8FDE\u7EED\uFF0C\u4E0D\u9057\u6F0F\u505C\u987F\u4E0E\u53CD\u5E94\u65F6\u95F4\u3002" : "\u6309\u672C\u6BB5\u4E8B\u4EF6\u987A\u5E8F\u81EA\u7136\u63A8\u8FDB\uFF0C\u4EE5\u955C\u5934\u5E8F\u53F7\u6216\u5148\u540E\u9636\u6BB5\u7EC4\u7EC7\u5185\u5BB9\uFF0C\u4E0D\u4F9D\u8D56\u7CBE\u786E\u65F6\u95F4\u6233\uFF0C\u4E0D\u4E3A\u8FFD\u9010\u79D2\u70B9\u538B\u7F29\u52A8\u4F5C\u6216\u5BF9\u767D\u3002";
  return [
    `\u751F\u6210 ${seconds} \u79D2\u89C6\u9891\u3002`,
    String(prompt).trim(),
    timing,
    SPEECH_EXECUTION,
    "\u4EBA\u7269\u8EAB\u4EFD\u3001\u670D\u88C5\u3001\u573A\u666F\u4E0E\u5149\u7EBF\u4FDD\u6301\u8FDE\u8D2F\uFF1B\u6BCF\u53E5\u53F0\u8BCD\u5B8C\u6574\u8BF4\u5B8C\u3002\u672A\u660E\u786E\u8981\u6C42\u65F6\u4E0D\u65B0\u589E\u5B57\u5E55\u3001\u6C34\u5370\u3001\u7247\u5934\u7247\u5C3E\u6216\u914D\u4E50\u3002"
  ].join("\n");
}
function endWithPunctuation(text) {
  const value = String(text ?? "").trim();
  if (!value) return "";
  return /[。．.!！?？;；~～:：,，]$/.test(value) ? value : `${value}\u3002`;
}

// src/providers/seedance.ts
init_connection();
init_config();

// src/workflow/real-person.ts
import { createHash as createHash3 } from "node:crypto";

// src/workflow/character-choice.ts
import { createHash as createHash2 } from "node:crypto";
import { mkdir as mkdir6, readFile as readFile4, writeFile as writeFile3, rename as rename4, rm as rm4 } from "node:fs/promises";
import path9 from "node:path";
init_connection();
var waiting = /* @__PURE__ */ new Map();
var localIds = /* @__PURE__ */ new WeakMap();
var nextId = 0;
var IMAGE = "\u5148\u751F\u6210\u89D2\u8272\u56FE\uFF08\u5355\u72EC\u8BA1\u8D39\uFF09";
var TEXT = "\u76F4\u63A5\u6587\u751F\u89C6\u9891";
function hasImages(args) {
  return [args?.firstFrameUrl, ...Array.isArray(args?.referenceImages) ? args.referenceImages : [args?.referenceImages], ...Array.isArray(args?.characterReferenceImages) ? args.characterReferenceImages : []].some((value) => typeof value === "string" && Boolean(value.trim()));
}
async function characterChoiceGate(ctx, config, exec, args) {
  if (exec.name !== "video_generate" || String(args?.resume || "").trim() || hasImages(args)) return null;
  const session = exec.agent?.session;
  const deny = (reason) => ({ kind: "deny", reason });
  if (!session || typeof session !== "object") return deny("\u63D0\u4EA4\u5DF2\u505C\u6B62\uFF1A\u7EAF\u6587\u751F\u89C6\u9891\u987B\u5148\u8BE2\u95EE\u662F\u5426\u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE\uFF0C\u5F53\u524D\u7F3A\u5C11\u53EF\u4EA4\u4E92\u4F1A\u8BDD\u3002");
  const stableId = typeof session.id === "string" ? session.id : typeof session.header?.id === "string" ? session.header.id : null;
  if (!localIds.has(session)) localIds.set(session, `live-${++nextId}`);
  const key = createHash2("sha256").update(JSON.stringify([stableId || localIds.get(session), args?.prompt || "", args?.duration, args?.resolution, args?.ratio])).digest("hex");
  const file = path9.join(dshHome(), "metaontic-video", "character-choices", key + ".json");
  try {
    async function choose() {
      if (stableId && args?.resetCharacterChoice !== true) {
        try {
          const saved = JSON.parse(await readFile4(file, "utf8"));
          if (saved.version === 1 && ["text_only", "generate_first"].includes(saved.choice)) return saved.choice;
        } catch (error) {
          if (error?.code !== "ENOENT") return null;
        }
      }
      const service = ctx.get?.("userQuestions") || exec.agent?.ctx?.get?.("userQuestions");
      if (typeof service?.ask !== "function") return null;
      const first = isVolcengine(config) ? "\u4F7F\u7528\u6211\u63D0\u4F9B\u7684\u89D2\u8272\u56FE" : IMAGE;
      const result = await timedStage("character_choice_wait", () => service.ask({
        agent: exec.agent,
        signal: exec.signal,
        ...exec.callId ? { wait: { callId: exec.callId } } : {},
        questions: [{
          id: "metaontic_character_reference",
          header: "\u89D2\u8272\u53C2\u8003\u56FE",
          question: isVolcengine(config) ? "\u662F\u5426\u5148\u51C6\u5907\u89D2\u8272\u53C2\u8003\u56FE\uFF1F\u5F53\u524D\u706B\u5C71\u76F4\u8FDE\u4E0D\u63D0\u4F9B\u4EE3\u751F\u6210\u56FE\u7247\u901A\u9053\uFF0C\u53EF\u4F7F\u7528\u4F60\u63D0\u4F9B\u7684\u89D2\u8272\u56FE\uFF0C\u6216\u76F4\u63A5\u6587\u751F\u89C6\u9891\u3002" : "\u662F\u5426\u5148\u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE\uFF1F\u56FE\u7247\u8C03\u7528\u5355\u72EC\u8BA1\u8D39\uFF0C\u751F\u6210\u540E\u5148\u770B\u56FE\u786E\u8BA4\uFF0C\u518D\u7528\u4E8E\u89C6\u9891\u548C\u540E\u7EED\u7EED\u62CD\u3002",
          multiSelect: false,
          options: [{ label: first, description: isVolcengine(config) ? "\u63D0\u4F9B\u89D2\u8272\u56FE\u5E76\u786E\u8BA4\u540E\u518D\u751F\u6210\u89C6\u9891\u3002" : "\u5148\u751F\u6210\u5E76\u5BA1\u6838\u89D2\u8272\u56FE\uFF0C\u56FE\u7247\u8D39\u7528\u4E0E\u89C6\u9891\u5206\u5F00\u3002" }, { label: TEXT, description: "\u4E0D\u751F\u6210\u89D2\u8272\u56FE\uFF0C\u6309\u7EAF\u6587\u751F\u65B9\u6848\u5236\u4F5C\u89C6\u9891\u3002" }]
        }]
      }));
      if (exec.signal?.aborted) return null;
      const answer = result?.answers?.find((item) => item.id === "metaontic_character_reference");
      const selected = answer?.custom ? answer.custom.trim() : answer?.selected?.length === 1 ? answer.selected[0] : "";
      const choice2 = selected === first ? "generate_first" : selected === TEXT ? "text_only" : null;
      if (!choice2) return null;
      if (stableId) {
        await mkdir6(path9.dirname(file), { recursive: true, mode: 448 });
        const temp = file + "." + Date.now() + ".tmp";
        try {
          await writeFile3(temp, JSON.stringify({ version: 1, choice: choice2, time: (/* @__PURE__ */ new Date()).toISOString() }), { mode: 384, flag: "wx" });
          await rename4(temp, file);
        } finally {
          await rm4(temp, { force: true }).catch(() => {
          });
        }
      }
      return choice2;
    }
    let pending = waiting.get(key);
    if (!pending) {
      pending = choose();
      waiting.set(key, pending);
    }
    let choice;
    try {
      choice = await pending;
    } finally {
      if (waiting.get(key) === pending) waiting.delete(key);
    }
    if (choice === "text_only") return null;
    if (choice === "generate_first") return deny(isVolcengine(config) ? "\u7528\u6237\u9009\u62E9\u5148\u4F7F\u7528\u89D2\u8272\u56FE\uFF0C\u5DF2\u505C\u6B62\u7EAF\u6587\u751F\u89C6\u9891\u63D0\u4EA4\u3002\u8BF7\u5148\u53D6\u5F97\u5E76\u5BA1\u6838\u7528\u6237\u63D0\u4F9B\u7684\u89D2\u8272\u56FE\uFF0C\u518D\u4F20referenceImages/characterReferenceImages\uFF1B\u4E0D\u8981\u91CD\u590D\u8BE2\u95EE\u6216\u76F4\u63A5\u751F\u6210\u89C6\u9891\u3002" : "\u7528\u6237\u5DF2\u660E\u786E\u9009\u62E9\u5148\u751F\u6210\u89D2\u8272\u56FE\uFF0C\u5DF2\u505C\u6B62\u7EAF\u6587\u751F\u89C6\u9891\u63D0\u4EA4\u3002\u8BF7\u5148\u7528video_prepare_image(operation:create_character)\u6309\u5DF2\u786E\u8BA4\u8BBE\u5B9A\u51FA\u56FE\uFF0C\u56FE\u7247\u5355\u72EC\u8BA1\u8D39\uFF1B\u5C55\u793A\u5BA1\u6838\u540E\u5C06\u56FE\u7247\u4F20\u5165referenceImages\u548CcharacterReferenceImages\uFF0C\u518D\u5355\u72EC\u786E\u8BA4\u89C6\u9891\u8D39\u7528\u4E0E\u5236\u4F5C\u3002\u4E0D\u8981\u91CD\u590D\u8BE2\u95EE\u6B64\u9009\u62E9\uFF0C\u4E0D\u8981\u76F4\u63A5\u91CD\u63D0\u7EAF\u6587\u751F\u89C6\u9891\uFF1B\u7528\u6237\u660E\u786E\u6539\u53D8\u65B9\u6848\u65F6\uFF0C\u4F20resetCharacterChoice:true\u91CD\u65B0\u53D6\u5F97\u9009\u62E9\u3002");
    return deny("\u89D2\u8272\u56FE\u9009\u62E9\u5C1A\u672A\u53D6\u5F97\u660E\u786E\u7B54\u590D\uFF0C\u5DF2\u505C\u6B62\u63D0\u4EA4\u3002\u53D6\u6D88\u3001\u8DF3\u8FC7\u3001pending\u3001\u4EA4\u4E92\u4E0D\u53EF\u7528\u6216\u8BB0\u5F55\u5931\u8D25\u90FD\u4E0D\u7B49\u4E8E\u9009\u62E9\u76F4\u63A5\u6587\u751F\u89C6\u9891\uFF1B\u6062\u590D\u8BE2\u95EE\u80FD\u529B\u540E\u518D\u7EE7\u7EED\uFF0C\u4E0D\u5F97\u9ED8\u8BA4\u8DF3\u8FC7\u3002");
  } catch {
    return deny("\u89D2\u8272\u56FE\u9009\u62E9\u672A\u5B8C\u6210\uFF0C\u672A\u63D0\u4EA4\u89C6\u9891\u3002\u8BF7\u6062\u590D\u8BE2\u95EE\u4E0E\u9009\u62E9\u8BB0\u5F55\u80FD\u529B\u540E\u518D\u7EE7\u7EED\uFF0C\u4E0D\u8981\u81EA\u52A8\u8DF3\u8FC7\u6216\u91CD\u63D0\u3002");
  }
}

// src/workflow/approval.ts
init_connection();

// src/workflow/costs.ts
init_config();
init_connection();
function formatAmount(value) {
  const number2 = Number(value);
  if (!Number.isFinite(number2)) return "0";
  const text = number2.toFixed(Math.abs(number2) >= 1 ? 2 : 4);
  return text.includes(".") ? text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : text;
}
function formatMoney(value, symbol = "\xA5") {
  return `${symbol}${formatAmount(value)}`;
}
function estimateRate(model, usesReference) {
  const id = String(model || "").toLowerCase();
  const hit = ESTIMATE_RATES.find(([prefix]) => id.startsWith(prefix));
  const table = hit ? hit[1] : ESTIMATE_RATES[0][1];
  return usesReference ? table.video : table.none;
}
function estimatePlan(config, toolName, args) {
  if (toolName === "video_extend") {
    const count = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
    const fallback = modelMaxSeconds(config);
    const seconds = clampInteger(
      args?.duration ?? fallback,
      MIN_SECONDS,
      modelMaxSeconds(config),
      fallback
    );
    return Array.from({ length: count }, () => ({ kind: "extend", seconds }));
  }
  return resolveTargetPlan(config, args).plan;
}
function estimateSteps(config, steps, selectedResolution = void 0) {
  const resolution = resolveResolution(config, { resolution: selectedResolution });
  const model = resolveModel(config);
  const pixels = resolution === "480p" && /^doubao-seedance-2-5/.test(model) ? [854, 480] : ESTIMATE_PIXELS[resolution] || ESTIMATE_PIXELS[FIXED_RESOLUTION];
  const tokensPerSecond = pixels[0] * pixels[1] * ESTIMATE_FPS / ESTIMATE_TOKEN_DIVISOR;
  return {
    model,
    resolution,
    segments: steps.map((step, index) => {
      const usesReference = step.kind === "extend" || step.usesVideoInput === true;
      const inputSeconds = usesReference ? Number(step.inputSeconds ?? steps[index - 1]?.seconds) : 0;
      if (!Number.isFinite(inputSeconds) || inputSeconds < 0 || usesReference && inputSeconds === 0) throw new Error("\u7EED\u62CD\u4F30\u4EF7\u7F3A\u5C11\u5B9E\u9645\u8F93\u5165\u89C6\u9891\u65F6\u957F\uFF0C\u4E0D\u80FD\u6309\u7EAF\u751F\u6210\u8D39\u7528\u4F30\u7B97\u3002");
      const tokens = Math.round(tokensPerSecond * (inputSeconds + step.seconds));
      return {
        index: index + 1,
        kind: step.kind,
        seconds: step.seconds,
        inputSeconds,
        billingMode: usesReference ? "with_video_input" : "without_video_input",
        tokens,
        usesReference,
        usd: tokens * estimateRate(model, usesReference) / 1e6
      };
    })
  };
}
function estimateUsage(config, toolName, args, actualPlan = void 0) {
  const plan = actualPlan ?? estimatePlan(config, toolName, args);
  const groupRatio = finiteNumber(ref(config, "estimateGroupRatio", 0.8)) ?? 1;
  const { model, resolution, segments } = estimateSteps(
    config,
    plan.map((step, index) => ({ ...step, inputSeconds: step.inputSeconds ?? (step.kind === "extend" ? index ? plan[index - 1].seconds : args?.inputVideoSeconds : 0) })),
    resolveResolution(config, args)
  );
  const usd = segments.reduce((sum, item) => sum + item.usd, 0) * groupRatio;
  return {
    model,
    resolution,
    segments,
    seconds: segments.reduce((sum, item) => sum + item.seconds, 0),
    tokens: segments.reduce((sum, item) => sum + item.tokens, 0),
    usd: Math.round(usd * 1e6) / 1e6
  };
}

// src/workflow/approval.ts
init_config();
async function remainingCostText(config, exec, remainingSteps, inputVideoSeconds = void 0) {
  if (isManualKey(config)) return { cost: `${connectionLabel(config)}\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39`, remain: "" };
  try {
    const estimated = estimateSteps(
      config,
      remainingSteps.map((step, index) => ({ ...step, inputSeconds: index ? remainingSteps[index - 1].seconds : inputVideoSeconds })),
      resolveResolution(config, exec?.arguments || {})
    );
    const groupRatio = finiteNumber(ref(config, "estimateGroupRatio", 0.8)) ?? 1;
    const usd = estimated.segments.reduce((sum, item) => sum + item.usd, 0) * groupRatio;
    const quota = await fetchDeviceQuota(config, exec?.signal);
    const data = quota.status === "ok" ? quota.data : {};
    const symbol = String(data.currency_symbol || "\xA5");
    const exchange = finiteNumber(data.usd_exchange_rate) ?? DEFAULT_USD_EXCHANGE_RATE;
    const remainAmount = finiteNumber(data.remain_amount);
    return {
      cost: `\u9884\u4F30 ${formatMoney(usd * exchange, symbol)}`,
      remain: remainAmount === null ? "" : `\u672C\u673A Key \u5269\u4F59 ${formatMoney(remainAmount, symbol)}`
    };
  } catch (error) {
    return { cost: `\u9884\u4F30\u8D39\u7528\u6CA1\u7B97\u51FA\u6765\uFF08${error?.message || error}\uFF09`, remain: "" };
  }
}
function segmentContinueLine({ toolName = "video_generate", done, lastSeconds, nextSeconds }) {
  const action = toolName === "video_extend" ? "\u5EF6\u957F" : "\u751F\u6210";
  const finished = done > 0 ? `\u7B2C ${done} \u6BB5\uFF08${lastSeconds} \u79D2\uFF09\u5DF2\u7ECF\u751F\u6210\u597D` : "\u8FD8\u6CA1\u6709\u751F\u6210\u4EFB\u4F55\u5206\u6BB5";
  return {
    zh: `${finished}\u3002\u63A5\u4E0B\u6765${action}\u7B2C ${done + 1} \u6BB5\uFF08${nextSeconds} \u79D2\uFF09`,
    en: `${done > 0 ? `Segment ${done} (${lastSeconds}s) is done. ` : ""}Next up: ${toolName === "video_extend" ? "extend" : "generate"} segment ${done + 1} (${nextSeconds}s)`
  };
}
async function fetchDeviceQuota(config, signal) {
  if (isManualKey(config)) return { status: "unknown", reason: `${connectionLabel(config)}\u8D39\u7528\u548C\u4F59\u989D\u8BF7\u5728\u6E20\u9053\u63A7\u5236\u53F0\u67E5\u770B` };
  const api = resolveRegisterApi(config);
  const deviceId = String(ref(config, "deviceId", "")).trim();
  const deviceSecret = String(ref(config, "deviceSecret", "")).trim();
  if (!deviceId || !deviceSecret) {
    return {
      status: "unknown",
      reason: "\u63D2\u4EF6\u91CC\u6CA1\u6709\u672C\u673A\u8BBE\u5907\u51ED\u636E\uFF08\u5728\u8BBE\u7F6E\u9875\u70B9\u4E00\u6B21\u300C\u767B\u5F55\u300D\u4F1A\u5199\u8FDB\u6765\uFF0C\u4E4B\u540E\u5C31\u80FD\u81EA\u52A8\u6821\u9A8C\u989D\u5EA6\uFF09"
    };
  }
  const timeout = AbortSignal.timeout(15e3);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(`${api}/api/v1/register/quota`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-Register-Token": String(ref(config, "registerToken", "")).trim() || DEFAULT_REGISTER_TOKEN,
        ...PLUGIN_VERSION ? { "X-Plugin-Version": PLUGIN_VERSION } : {}
      },
      body: JSON.stringify({ device_id: deviceId, device_secret: deviceSecret }),
      signal: requestSignal
    });
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 200) };
      }
    }
    if (!response.ok || body && typeof body === "object" && body.code) {
      return {
        status: "unknown",
        reason: body && (body.message || body.detail) || `HTTP ${response.status}`
      };
    }
    return { status: "ok", data: body && body.data || body || {} };
  } catch (error) {
    return { status: "unknown", reason: error?.message || String(error) };
  }
}
function approvalPolicy(ctx, exec) {
  try {
    const approval = ctx.get("approval");
    if (!approval) return "missing";
    const session = exec?.agent?.session;
    const override = session && typeof approval.overrideOf === "function" ? approval.overrideOf(session) : void 0;
    return override || approval.config?.policy || "ask";
  } catch {
    return "ask";
  }
}
function planSummary(estimate) {
  if (!estimate) return "\u65F6\u957F\u672A\u77E5";
  const sizes = estimate.segments.map((item) => `${item.seconds}s`).join(" + ");
  return `${estimate.segments.length} \u6BB5\uFF08${sizes}\uFF09\u5171 ${estimate.seconds} \u79D2`;
}
function setupGate(ctx, exec) {
  const args = exec.arguments && typeof exec.arguments === "object" ? exec.arguments : {};
  if (args?.install !== true) return { kind: "allow" };
  const { os: os3, installs, bootstrap } = ffmpegInstallOptions();
  const command = String(args?.target || "ffmpeg") === "package-manager" && bootstrap ? bootstrap.command : installs[0].command;
  if (approvalPolicy(ctx, exec) === "never") {
    return {
      kind: "deny",
      reason: `\u5F53\u524D\u6743\u9650\u6A21\u5F0F\u5173\u95ED\u4E86\u5BA1\u6279\u63D0\u793A\uFF08\u5B8C\u5168\u8BBF\u95EE\uFF09\uFF0C\u88C5\u73AF\u5883\u8FD9\u79CD\u4F1A\u5728\u672C\u673A\u8DD1\u547D\u4EE4\u7684\u64CD\u4F5C\u6CA1\u6CD5\u786E\u8BA4\uFF0C\u5DF2\u505C\u6B62\u3002\u628A\u6743\u9650\u5207\u5230\u300C\u5DE5\u4F5C\u533A\u5199\u5165\u300D\u6216\u300C\u53EA\u8BFB\u300D\u540E\u518D\u8BA9\u6211\u88C5\uFF1B\u4E5F\u53EF\u4EE5\u7167\u7740\u8FD9\u6761\u547D\u4EE4\u81EA\u5DF1\u5728\u7EC8\u7AEF\u6267\u884C\uFF1A${command}\uFF08${os3}\uFF09\u3002`
    };
  }
  return {
    kind: "ask",
    reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u5728 ${os3} \u4E0A\u6267\u884C\u5B89\u88C5\u547D\u4EE4\u300C${command}\u300D\u3002`,
    displayReason: {
      zh: `\u51C6\u5907\u5728\u8FD9\u53F0\u7535\u8111\u4E0A\u88C5 ffmpeg\uFF1A${command}\uFF08${os3}\uFF09\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u6267\u884C\uFF0C\u88C5\u5B8C\u4F1A\u81EA\u52A8\u63A5\u7740\u628A\u89C6\u9891\u751F\u6210\u51FA\u6765\u3002`,
      en: `About to install ffmpeg on this machine: ${command} (${os3}). It runs only after you allow it; the video generation continues right after.`
    }
  };
}
async function ffmpegConsentGate(config, exec, args) {
  if (exec.name !== "video_generate" && exec.name !== "video_extend") return null;
  if (args?.merge === false) return null;
  let plan = null;
  let doneSteps = [];
  try {
    const gateArgs = await estimateArgsFor(config, exec.name, args);
    if (gateArgs?.merge === false) return null;
    plan = gateArgs.remainingPlan ?? estimatePlan(config, exec.name, gateArgs);
    const dir = resumeDirOf(args?.resume);
    if (dir) {
      const data = await readPauseFile(dir);
      doneSteps = (data.steps || []).map((step) => ({ kind: step.kind, seconds: step.seconds }));
    }
  } catch {
    plan = null;
  }
  const allSteps = [...doneSteps, ...plan || []];
  if (!plan || allSteps.length < 2) return null;
  if (await hasFfmpeg(config, exec.signal)) return null;
  const { os: os3, installs } = ffmpegInstallOptions();
  const command = installs[0].command;
  const sizes = allSteps.map((step) => `${step.seconds}s`).join(" + ");
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  const lines = [
    `\u672C\u673A\u6CA1\u6709 ${binary}\uFF0C\u8FD9\u6761\u6210\u7247\u662F ${allSteps.reduce((sum, step) => sum + step.seconds, 0)} \u79D2\uFF08\u4F1A\u62C6\u6210 ${allSteps.length} \u6BB5\uFF1A${sizes}\uFF09\uFF0C\u6CA1\u6709 ffmpeg \u5C31\u6CA1\u6CD5\u5408\u5E76\u6210\u4E00\u6761\uFF0C\u6240\u4EE5\u5148\u505C\u4E0B\u6765\u4E86\uFF0C\u8FD8\u6CA1\u6709\u8C03\u7528\u6A21\u578B\u3001\u6CA1\u6709\u4EA7\u751F\u8D39\u7528\u3002`,
    "\u8BF7\u5728\u5BF9\u8BDD\u6846\u91CC\u5148\u548C\u7528\u6237\u786E\u8BA4\uFF0C\u4E0D\u8981\u81EA\u5DF1\u7ED5\u8FC7\u8FD9\u4E00\u6B65\uFF1A",
    `1) \u95EE\u7528\u6237\u8981\u4E0D\u8981\u73B0\u5728\u88C5 ffmpeg \u2014\u2014 \u8BF4\u6E05\u4ED6\u7684\u7CFB\u7EDF\uFF08${os3}\uFF09\u548C\u547D\u4EE4\uFF1A${command}`,
    "   \uFF08\u88C5\u597D\u540E\u91CD\u8DD1\u8FD9\u6B21\u751F\u6210\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\u6210\u4E00\u6761\uFF0C\u5206\u6BB5\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\u3002",
    '2) \u7528\u6237\u540C\u610F\u5B89\u88C5\uFF1A\u8C03\u7528 video_setup\uFF08install:true\uFF09\u2014\u2014\u63D2\u4EF6\u4F1A\u6267\u884C\u4E0A\u9762\u7684\u547D\u4EE4\uFF0C\u5BBF\u4E3B\u4F1A\u5148\u628A\u8FD9\u6761\u547D\u4EE4\u62FF\u7ED9\u7528\u6237\u786E\u8BA4\uFF1B\u88C5\u5B8C\u5B83\u4F1A\u81EA\u5DF1\u9A8C\u8BC1\uFF0C\u6210\u529F\u540E\u4F60\u6309\u539F duration \u91CD\u65B0\u8C03\u7528 video_generate \u7EE7\u7EED\u751F\u6210\u5373\u53EF\uFF08\u4E00\u822C\u662F\u5148\u88C5\u5305\u7BA1\u7406\u5668\uFF1A\u672C\u673A\u8FDE brew \u90FD\u6CA1\u6709\u65F6\uFF0Cvideo_setup \u4F1A\u8FD4\u56DE nextStep\uFF0C\u7528 target:"package-manager" \u518D\u88C5\u4E00\u6B21\uFF09\u3002',
    "3) \u7528\u6237\u4E0D\u60F3\u88C5\u3001\u6216\u8005\u88C5\u4E0D\u4E86\uFF1A\u5E26 `merge:false` \u91CD\u65B0\u8C03\u7528 video_generate\uFF0C\u63D2\u4EF6\u5C31\u53EA\u751F\u6210\u5E76\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF08\u6BCF\u6BB5\u94FE\u63A5 + \u672C\u5730\u6587\u4EF6\uFF09\uFF0C\u8FD9\u6B21\u4E0D\u4F1A\u518D\u62E6\u3002",
    "\u5DF2\u7ECF\u88C5\u8FC7\u4F46\u4E0D\u5728\u9ED8\u8BA4\u4F4D\u7F6E\u7684\u8BDD\uFF0C\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\uFF1B\u5B89\u88C5\u5305\u81EA\u5E26 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u4E00\u8D77\u89E3\u51B3\u3002"
  ];
  return {
    kind: "deny",
    reason: lines.join("\n"),
    info: { ffmpegMissing: true, os: os3, command, segments: allSteps.length }
  };
}
async function estimateArgsFor(config, toolName, args) {
  const dir = resumeDirOf(args?.resume);
  if (!dir) return args;
  const data = await readPauseFile(dir);
  assertResumeConnection(data, config, args);
  const merged = { ...data.options || {}, ...args };
  let plan;
  if (toolName === "video_generate") {
    plan = resumePlanFrom(data, {
      askedTotal: args?.duration == null ? null : clampInteger(args.duration, MIN_SECONDS, Number.MAX_SAFE_INTEGER, 0),
      segmentSeconds: resolveSegmentSeconds(config, args?.segmentSeconds)
    }).plan;
  } else {
    const fullPlan = data.plan.map((step) => ({ ...step }));
    if (args?.segments != null) {
      const count = clampInteger(args.segments, 1, MAX_SEGMENTS, 1);
      const seconds = clampInteger(args.duration, MIN_SECONDS, modelMaxSeconds(config), modelMaxSeconds(config));
      for (let n = 0; n < count && fullPlan.length < MAX_SEGMENTS; n++) fullPlan.push({ kind: "extend", seconds });
    }
    plan = fullPlan.slice(Number(data.done) || 0);
  }
  const previous = (data.steps || []).at(-1);
  return {
    ...merged,
    inputVideoSeconds: previous?.durationSeconds ?? previous?.seconds ?? merged.inputVideoSeconds,
    remainingPlan: data.pendingTask || data.deliveryPending ? [] : plan,
    duration: sumStepSeconds(plan)
  };
}
async function preflightGate(ctx, config, exec) {
  if (exec.name === "video_setup") return setupGate(ctx, exec);
  if (exec.name === "media_submission") {
    if (exec.arguments?.action === "get") return { kind: "allow" };
    if (approvalPolicy(ctx, exec) === "never") return { kind: "deny", reason: "\u9700\u8981\u7528\u6237\u786E\u8BA4\u539F\u63D0\u4EA4\u7684\u6838\u5BF9\u7ED3\u679C\u3002" };
    return { kind: "ask", reason: exec.arguments?.taskId ? "\u786E\u8BA4\u5C06\u9632\u91CD\u8BB0\u5F55\u5173\u8054\u5230\u6E20\u9053\u4FA7\u6838\u5BF9\u51FA\u7684\u539F\u4EFB\u52A1 ID\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u3002" : "\u8BF7\u786E\u8BA4\u5DF2\u7ECF\u5728\u6E20\u9053\u4FA7\u6838\u5BF9\uFF1A\u539F\u8BF7\u6C42\u6CA1\u6709\u521B\u5EFA\u4EFB\u52A1\u3002\u89E3\u9501\u540E\u518D\u751F\u6210\u4F1A\u4EA7\u751F\u65B0\u8D39\u7528\uFF1B\u82E5\u539F\u4EFB\u52A1\u5B9E\u9645\u5B58\u5728\uFF0C\u53EF\u80FD\u91CD\u590D\u6263\u8D39\u3002" };
  }
  if (exec.name === "video_prepare_image") {
    const creating = exec.arguments?.operation === "create_character";
    if (String(exec.arguments?.taskId || "").trim()) return { kind: "allow" };
    if (approvalPolicy(ctx, exec) === "never") return { kind: "deny", reason: "\u5F53\u524D\u6743\u9650\u6A21\u5F0F\u65E0\u6CD5\u8FDB\u884C\u56FE\u7247\u8C03\u7528\u786E\u8BA4\u3002" };
    if (!creating && exec.arguments?.characterType === "realistic") return { kind: "deny", reason: "\u771F\u4EBA\u9650\u5236\u8F6C\u6362\u5FC5\u987B\u4F7F\u7528\u975E\u771F\u4EBA\u98CE\u683C\uFF0C\u4E0D\u80FD\u8F6C\u6362\u4E3A\u771F\u4EBA\u5199\u5B9E\u3002" };
    const characterLabel = exec.arguments?.characterType === "realistic" ? "\u771F\u4EBA\u5199\u5B9E" : "\u975E\u771F\u4EBA";
    if (creating) return { kind: "ask", reason: "\u8C03\u7528Seedream\u6309\u6587\u5B57\u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE\uFF0C\u56FE\u7247\u5355\u72EC\u8BA1\u8D39\u3002\u5B8C\u6210\u540E\u5148\u5C55\u793A\u5E76\u6838\u5BF9\u89D2\u8272\u548C\u98CE\u683C\uFF0C\u786E\u8BA4\u540E\u624D\u7528\u4E8E\u89C6\u9891\uFF1B\u89C6\u9891\u751F\u6210\u53E6\u884C\u786E\u8BA4\u548C\u8BA1\u8D39\u3002", displayReason: { zh: `\u5148\u751F\u6210\u4E00\u5F20${characterLabel}\u89D2\u8272\u53C2\u8003\u56FE\uFF0C\u56FE\u7247\u8C03\u7528\u5355\u72EC\u8BA1\u8D39\u3002\u751F\u6210\u540E\u5148\u770B\u56FE\u786E\u8BA4\uFF0C\u518D\u7528\u4E8E\u89C6\u9891\uFF1B\u73B0\u5728\u4E0D\u4F1A\u751F\u6210\u89C6\u9891\u3002\u662F\u5426\u540C\u610F\uFF1F`, en: `Generate one ${exec.arguments?.characterType === "realistic" ? "photorealistic" : "stylized"} character reference image, billed separately. Review it before any separately confirmed video generation.` } };
    return { kind: "ask", reason: "\u8C03\u7528 Seedream \u5C06\u771F\u4EBA\u53C2\u8003\u56FE\u8F6C\u4E3A\u975E\u771F\u4EBA\u98CE\u683C\uFF1B\u56FE\u7247\u751F\u6210\u5355\u72EC\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\uFF0C\u89C6\u9891\u8D39\u7528\u53E6\u8BA1\u3002", displayReason: { zh: "\u5C06\u8C03\u7528 Seedream \u5904\u7406\u53C2\u8003\u56FE\uFF0C\u56FE\u7247\u8C03\u7528\u5355\u72EC\u8BA1\u8D39\uFF0C\u89C6\u9891\u8D39\u7528\u53E6\u8BA1\u3002\u786E\u8BA4\u540E\u5F00\u59CB\u5904\u7406\u3002", en: "Use Seedream to stylize the reference. Image calls are billed separately from video. Confirm to proceed." } };
  }
  const rawArgs = exec.arguments && typeof exec.arguments === "object" ? exec.arguments : {};
  let effectiveArgs = rawArgs;
  let resumeSegment = null;
  if (resumeDirOf(rawArgs.resume)) {
    try {
      const saved = await readPauseFile(resumeDirOf(rawArgs.resume));
      if (Object.values(saved.operationState || {}).some((state) => state.phase === "review")) {
        if (rawArgs.referenceImagesReviewed !== true) return { kind: "allow" };
        if (approvalPolicy(ctx, exec) === "never") return { kind: "deny", reason: "\u9700\u8981\u786E\u8BA4\u8F6C\u6362\u56FE\u7247\u6548\u679C\u4E0E\u89C6\u9891\u91CD\u8BD5\u3002" };
        return { kind: "ask", reason: "\u8BF7\u786E\u8BA4\u5DF2\u770B\u8FC7\u8F6C\u6362\u540E\u7684\u5168\u90E8\u56FE\u7247\uFF0C\u56FE\u7247\u5DF2\u5448\u73B0\u975E\u771F\u4EBA\u98CE\u683C\u4E14\u7B26\u5408\u8981\u6C42\uFF0C\u5E76\u540C\u610F\u4F7F\u7528\u8FD9\u4E9B\u56FE\u7247\u91CD\u8BD5\u89C6\u9891\u4E00\u6B21\u3002\u89C6\u9891\u91CD\u8BD5\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\uFF1B\u56FE\u7247\u4E0D\u5408\u9002\u8BF7\u62D2\u7EDD\uFF0C\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u91CD\u753B\u3002" };
      }
      effectiveArgs = await estimateArgsFor(config, exec.name, rawArgs);
      const remaining = effectiveArgs.remainingPlan;
      if (remaining?.length === 0) return { kind: "allow" };
      const lastStep = (saved.steps || []).at(-1);
      resumeSegment = {
        toolName: exec.name,
        done: Number(saved.done) || 0,
        lastSeconds: lastStep?.durationSeconds ?? lastStep?.seconds ?? 0,
        nextSeconds: remaining?.[0]?.seconds ?? 0,
        remainingSeconds: sumStepSeconds(remaining || []),
        remainingSteps: remaining || [],
        inputVideoSeconds: Number(effectiveArgs.inputVideoSeconds) || void 0
      };
    } catch (error) {
      return { kind: "deny", reason: error?.message || String(error) };
    }
  }
  let resumeLead = null;
  if (resumeSegment) {
    const line = segmentContinueLine(resumeSegment);
    let rest = `\u6574\u6761\u8FD8\u5DEE ${resumeSegment.remainingSeconds} \u79D2`;
    try {
      const measured = await remainingCostText(config, exec, resumeSegment.remainingSteps, resumeSegment.inputVideoSeconds);
      rest += `\uFF08${measured.cost}${measured.remain ? `\uFF1B${measured.remain}` : ""}\uFF09`;
    } catch {
    }
    resumeLead = {
      zh: `${line.zh}\uFF0C${rest}\u3002`,
      en: `${line.en}; about ${resumeSegment.remainingSeconds}s left in the whole video. `,
      tailZh: "\u70B9\u300C\u5141\u8BB8\u300D\u7EE7\u7EED\u5F80\u4E0B\u505A\uFF1B\u70B9\u300C\u62D2\u7EDD\u300D\u5C31\u5148\u4E0D\u7EE7\u7EED\uFF0C\u5DF2\u7ECF\u751F\u6210\u597D\u7684\u5206\u6BB5\u4E0D\u7528\u91CD\u505A\uFF0C\u4E4B\u540E\u968F\u65F6\u80FD\u63A5\u7740\u505A\uFF08\u4E0D\u7528\u91CD\u5934\u518D\u6765\uFF09\u3002",
      tailEn: " Allow to continue; reject to stop here \u2014 the segments already generated are kept and you can continue later."
    };
  }
  if (approvalPolicy(ctx, exec) === "never") {
    return {
      kind: "deny",
      reason: "\u5F53\u524D\u6743\u9650\u6A21\u5F0F\u5173\u95ED\u4E86\u5BA1\u6279\u63D0\u793A\uFF08\u5B8C\u5168\u8BBF\u95EE\uFF09\uFF0C\u65E0\u6CD5\u505A\u4EBA\u5DE5\u786E\u8BA4\uFF0C\u5DF2\u505C\u6B62\u8C03\u7528\u3002\u628A\u6743\u9650\u5207\u5230\u300C\u5DE5\u4F5C\u533A\u5199\u5165\u300D\u6216\u300C\u53EA\u8BFB\u300D\u540E\u518D\u751F\u6210\u89C6\u9891\u3002"
    };
  }
  const args = exec.arguments && typeof exec.arguments === "object" ? exec.arguments : {};
  const characterChoice = await characterChoiceGate(ctx, config, exec, args);
  if (characterChoice) return characterChoice;
  const consent = await ffmpegConsentGate(config, exec, args);
  if (consent) return consent;
  if (isManualKey(config)) {
    assertConfigured(config, resolveApiKey(config));
    return {
      kind: "ask",
      reason: `${resumeLead ? resumeLead.zh : ""}\u8C03\u7528${connectionLabel(config)} ${resolveModel(config)} \xB7 ${resolveResolution(config, effectiveArgs)}\uFF0C\u6309\u6E20\u9053\u8D26\u6237\u5B9E\u9645\u7528\u91CF\u8BA1\u8D39\u3002`,
      displayReason: {
        zh: `${resumeLead ? resumeLead.zh : ""}\u672C\u6B21\u5C06\u901A\u8FC7${connectionLabel(config)}\u751F\u6210 ${resolveResolution(config, effectiveArgs)} \u89C6\u9891\uFF0C\u6309\u6E20\u9053\u8D26\u6237\u5B9E\u9645\u7528\u91CF\u8BA1\u8D39\u3002\u786E\u8BA4\u540E\u5F00\u59CB\u3002${resumeLead ? resumeLead.tailZh : ""}`,
        en: `${resumeLead ? resumeLead.en : ""}Generate ${resolveResolution(config, effectiveArgs)} video via ${connectionLabel(config)}, billed to your channel account. Confirm to continue.${resumeLead ? resumeLead.tailEn : ""}`
      }
    };
  }
  let estimate = null;
  try {
    const prepared = await estimateArgsFor(config, exec.name, args);
    const plan = prepared.remainingPlan ?? estimatePlan(config, exec.name, prepared);
    estimate = estimateUsage(config, exec.name, prepared, plan.slice(0, 1));
  } catch {
    estimate = null;
  }
  const quota = await fetchDeviceQuota(config, exec.signal);
  const data = quota.status === "ok" ? quota.data : {};
  const symbol = String(data.currency_symbol || "\xA5");
  const perUnit = finiteNumber(data.quota_per_unit) ?? DEFAULT_QUOTA_PER_UNIT;
  const exchange = finiteNumber(data.usd_exchange_rate) ?? DEFAULT_USD_EXCHANGE_RATE;
  const needQuota = estimate ? Math.round(estimate.usd * perUnit) : null;
  const needMoney = estimate ? formatMoney(estimate.usd * exchange, symbol) : null;
  const remainQuota = finiteNumber(data.remain_quota);
  const remainAmount = finiteNumber(data.remain_amount);
  const costText = needMoney === null ? "\u8FD9\u6B21\u8C03\u7528\u7684\u8D39\u7528\u6CA1\u6CD5\u9884\u4F30" : `\u9884\u4F30 ${needMoney}`;
  const remainMoneyText = `${formatMoney(remainAmount === null ? 0 : remainAmount, symbol)}`;
  const remainZh = remainQuota === null ? `\u672C\u673A Key \u7684\u989D\u5EA6\u8BFB\u4E0D\u5230\uFF08${quota.reason || "\u670D\u52A1\u7AEF\u6CA1\u56DE\u989D\u5EA6"}\uFF09` : `\u672C\u673A Key \u5269\u4F59 ${remainMoneyText}`;
  const remainEn = remainQuota === null ? `this key's quota could not be read (${quota.reason || "the service returned none"})` : `this key has ${remainMoneyText} left`;
  if (needQuota !== null && remainQuota !== null && remainQuota < needQuota) {
    return {
      kind: "deny",
      reason: `\u989D\u5EA6\u4E0D\u8DB3\uFF0C\u5DF2\u505C\u6B62\u8C03\u7528\uFF1A\u672C\u6B21\u9884\u4F30\u9700\u8981 ${needMoney ?? "\u65E0\u6CD5\u9884\u4F30"}\uFF0C\u8FD9\u628A Key \u53EA\u5269 ${remainMoneyText}\u3002\u8BF7\u5145\u503C\u6216\u627E\u7BA1\u7406\u5458\u6362\u4E00\u628A\u989D\u5EA6\u591F\u7684 Key \u540E\u91CD\u8BD5\u3002`
    };
  }
  const total = estimate ? `${estimate.model} \xB7 ${estimate.resolution} \xB7 ${planSummary(estimate)}` : `${resolveModel(config)} \xB7 ${resolveResolution(config, effectiveArgs)}`;
  const auditTax = estimate ? `\u9884\u4F30\u6D88\u8017 ${estimate.tokens.toLocaleString("en-US")} token \u2248 ${needMoney ?? "\u65E0\u6CD5\u9884\u4F30"}\uFF08${needQuota === null ? "\u989D\u5EA6\u672A\u77E5" : `${needQuota.toLocaleString("en-US")} \u989D\u5EA6`}\uFF09` : "\u8FD9\u6B21\u8C03\u7528\u7684\u8D39\u7528\u65E0\u6CD5\u9884\u4F30";
  return {
    kind: "ask",
    reason: `${resumeLead ? resumeLead.zh : ""}\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF08${total}\uFF09\u3002${auditTax}\uFF1B\u672C\u673A Key \u5269\u4F59 ${remainQuota === null ? "\u989D\u5EA6\u8BFB\u4E0D\u5230" : `${remainMoneyText} / ${remainQuota.toLocaleString("en-US")} \u989D\u5EA6`}\u3002`,
    displayReason: {
      zh: `${resumeLead ? resumeLead.zh : ""}\u672C\u6B21\u4F1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF1A${total}\uFF1B${costText}\uFF0C${remainZh}\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u771F\u6B63\u8C03\u7528\u3002${resumeLead ? resumeLead.tailZh : ""}`,
      en: `${resumeLead ? resumeLead.en : ""}This will call the video model: ${total}. Estimated cost ${needMoney === null ? "unknown" : needMoney}; ${remainEn}. The call runs only after you allow it.` + (resumeLead ? resumeLead.tailEn : "")
    }
  };
}

// src/workflow/real-person.ts
async function recoverRealPersonImages(config, body, ctx, exec, final, state = {}, saveState = async () => {
}) {
  const images = (body.content || []).filter((item) => item.type === "image_url" && item.image_url?.url);
  if (!images.length) {
    final.error = `${final.error || ""}\u3002\u672C\u6B21\u6CA1\u6709\u53EF\u8F6C\u6362\u7684\u56FE\u7247\u53C2\u8003\uFF1B\u82E5\u9650\u5236\u6765\u81EA\u53C2\u8003\u89C6\u9891\uFF0C\u8BF7\u63D0\u4F9B\u975E\u771F\u4EBA\u89C6\u9891\u7D20\u6750\u3002`;
    return;
  }
  if (!state.conversionApproved) {
    const approval = ctx?.get?.("approval");
    if (!approval?.request || !exec?.agent || approvalPolicy(ctx, exec) === "never") {
      final.error = `${final.error || ""}\u3002\u5F53\u524D\u65E0\u6CD5\u53D6\u5F97\u8F6C\u6362\u6388\u6743\uFF0C\u5DF2\u505C\u6B62\uFF0C\u672A\u8F6C\u6362\u6216\u91CD\u8BD5\u3002`;
      return;
    }
    let outcome;
    try {
      outcome = await approval.request({
        agent: exec.agent,
        toolName: "video_prepare_image",
        ...exec.callId ? { callId: exec.callId } : {},
        ...exec.signal ? { signal: exec.signal } : {},
        reason: `\u89C6\u9891\u63A5\u53E3\u8FD4\u56DE\u771F\u4EBA\u9650\u5236\u3002\u662F\u5426\u5C06\u672C\u6B21 ${images.length} \u5F20\u53C2\u8003\u56FE\u8F6C\u6362\u4E3A\u975E\u771F\u4EBA\u4E8C\u7EF4\u52A8\u753B\u98CE\u683C\uFF1F\u56FE\u7247\u5904\u7406\u5355\u72EC\u8BA1\u8D39\u3002\u8F6C\u6362\u540E\u5148\u5C55\u793A\u6838\u5BF9\uFF0C\u4E0D\u7ACB\u5373\u91CD\u8BD5\u89C6\u9891\u3002`,
        displayReason: {
          zh: `\u89C6\u9891\u63A5\u53E3\u63D0\u793A\u53C2\u8003\u7D20\u6750\u542B\u771F\u4EBA\u3002\u662F\u5426\u7528 Seedream \u5C06\u672C\u6B21 ${images.length} \u5F20\u53C2\u8003\u56FE\u8F6C\u4E3A\u975E\u771F\u4EBA\u4E8C\u7EF4\u52A8\u753B\u98CE\u683C\uFF1F\u56FE\u7247\u5904\u7406\u5355\u72EC\u8BA1\u8D39\u3002\u5B8C\u6210\u540E\u5148\u5C55\u793A\u56FE\u7247\uFF0C\u786E\u8BA4\u6548\u679C\u540E\u624D\u91CD\u8BD5\u89C6\u9891\uFF0C\u89C6\u9891\u8D39\u7528\u53E6\u8BA1\u3002\u62D2\u7EDD\u6216\u53D6\u6D88\u5C06\u505C\u6B62\u3002`,
          en: `Convert ${images.length} reference image(s) to non-photorealistic 2D animation with Seedream? Images are billed separately. Review the results before a separately confirmed video retry. Reject or cancel to stop.`
        }
      });
    } catch {
      outcome = "unavailable";
    }
    if (String(outcome) !== "allowed-once") {
      final.error = `${final.error || ""}\u3002\u672A\u53D6\u5F97\u7528\u6237\u8F6C\u6362\u540C\u610F\uFF0C\u5DF2\u505C\u6B62\uFF0C\u672A\u8F6C\u6362\u56FE\u7247\u6216\u91CD\u8BD5\u89C6\u9891\u3002`;
      return;
    }
    state.conversionApproved = true;
    state.phase = "converting";
    state.images ||= {};
    await saveState();
  }
  const replacements = /* @__PURE__ */ new Map();
  try {
    for (const item of images) {
      const source = String(item.image_url.url);
      const key = createHash3("sha256").update(source).digest("hex");
      const entry = state.images[key] ||= {};
      if (entry.failed) throw new Error(`\u56FE\u7247\u4EFB\u52A1 ${entry.taskId || ""} \u5DF2\u660E\u786E\u5931\u8D25\uFF1A${entry.failed}\u3002\u4E0D\u81EA\u52A8\u518D\u6B21\u51FA\u56FE\u3002`);
      if (!entry.imageUrl) {
        const progress = {
          onCreated: async (taskId) => {
            entry.taskId = taskId;
            await saveState();
          },
          onCompleted: async (result) => {
            entry.imageUrl = result.imageUrl;
            await saveState();
          }
        };
        try {
          await prepareImageTool(config, progress).execute(entry.taskId ? { taskId: entry.taskId } : { image: source, style: "\u660E\u663E\u7684\u975E\u771F\u4EBA\u4E8C\u7EF4\u52A8\u753B\u89D2\u8272\uFF0C\u4FDD\u6301\u539F\u6784\u56FE\u3001\u670D\u88C5\u548C\u52A8\u4F5C" }, exec);
        } catch (error) {
          if (error?.terminal) entry.failed = error.message;
          if (error?.submissionId) entry.submissionId = error.submissionId;
          await saveState();
          throw error;
        }
      }
      const resolved = await resolveImageInput(entry.imageUrl, "\u8F6C\u6362\u540E\u7684\u53C2\u8003\u56FE");
      replacements.set(source, String(resolved.url));
    }
  } catch (error) {
    final.error = `${final.error || ""}\u3002Seedream \u8F6C\u6362\u672A\u5B8C\u6210\uFF1A${error?.message || error}\u3002\u5DF2\u4FDD\u5B58\u9010\u5F20\u8FDB\u5EA6\uFF1B\u7EE7\u7EED\u65F6\u67E5\u8BE2\u5DF2\u6709\u4EFB\u52A1\u5E76\u590D\u7528\u5DF2\u5B8C\u6210\u56FE\u7247\uFF0C\u4E0D\u91CD\u65B0\u51FA\u56FE\u3002`;
    final.errorCode = error?.code || "image_conversion_incomplete";
    return;
  }
  state.convertedBody = {
    ...body,
    content: body.content.map((item) => item.type === "image_url" && replacements.has(item.image_url?.url) ? { ...item, image_url: { ...item.image_url, url: replacements.get(item.image_url.url) } } : item)
  };
  state.phase = "review";
  await saveState();
  setReferenceReview(final, state);
}
function setReferenceReview(final, state) {
  final.status = "review_required";
  final.errorCode = "reference_review_required";
  final.error = "\u56FE\u7247\u5DF2\u8F6C\u6362\u3002\u8BF7\u5148\u5C55\u793A\u6BCF\u5F20\u7ED3\u679C\uFF0C\u6838\u5BF9\u4E3A\u975E\u771F\u4EBA\u4E14\u98CE\u683C\u7B26\u5408\u8981\u6C42\uFF1B\u7528\u6237\u786E\u8BA4\u540E\u7528\u539F resume \u5E76\u4F20 referenceImagesReviewed:true\uFF0C\u624D\u4F1A\u91CD\u8BD5\u89C6\u9891\u4E00\u6B21\u3002\u82E5\u4ECD\u50CF\u771F\u4EBA\u6216\u4E0D\u6EE1\u610F\uFF0C\u505C\u6B62\uFF0C\u4E0D\u81EA\u52A8\u518D\u8F6C\u6362\u3002";
  final.convertedReferences = state.convertedBody.content.filter((item) => item.type === "image_url").map((item) => ({ role: item.role, imageUrl: item.image_url.url }));
}

// src/providers/seedance.ts
function normalizeReferenceUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) throw new Error("\u53C2\u8003\u89C6\u9891 URL \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (/^asset:\/\/[A-Za-z0-9_-]+$/.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("\u53C2\u8003\u89C6\u9891\u5FC5\u987B\u662F https:// \u6216 http:// \u5F00\u5934\u7684\u516C\u7F51 URL\uFF08\u4E0D\u80FD\u7528\u672C\u5730\u6587\u4EF6\u8DEF\u5F84\uFF09\u3002");
  }
  return url;
}
function buildRequestBody(config, args, referenceVideoUrl) {
  const model = resolveModel(config);
  const seconds = clampInteger(
    args.duration,
    MIN_SEGMENT_SECONDS,
    modelMaxSeconds(config),
    modelMaxSeconds(config)
  );
  const mode = args.mode === "closeup" ? "closeup" : "continuous";
  const prompt = String(args.prompt ?? "").trim();
  const startAt = args.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt)));
  const direction = args.direction === "forward" ? "forward" : "backward";
  const wording = args.wording === "after" ? "after" : "extend";
  const content = [
    { type: "text", text: buildExtensionPrompt({ prompt, seconds, startAt, mode, direction, wording, transitionDescription: args.transitionDescription }) },
    { type: "video_url", video_url: { url: referenceVideoUrl }, role: "reference_video" },
    ...(args.characterReferences || []).map((item) => ({ type: "image_url", image_url: { url: item.image_url.url }, role: "reference_image" }))
  ];
  if (args.characterReferences?.length) {
    content[0].text = `\u56FA\u5B9A\u4E3B\u4F53\u5916\u89C2\u4EE5\u56FE\u72471\u81F3\u56FE\u7247${args.characterReferences.length}\u4E2D\u7684\u6700\u521D\u89D2\u8272\u8BBE\u5B9A\u4E3A\u51C6\uFF0C\u4FDD\u6301\u5BF9\u5E94\u4E3B\u4F53\u7684\u9762\u90E8\u3001\u53D1\u578B\u3001\u670D\u9970\u4E0E\u4F53\u578B\uFF1B\u56FE\u7247\u4EC5\u7EA6\u675F\u4E3B\u4F53\u5916\u89C2\uFF0C\u4E0D\u91CD\u6F14\u56FE\u7247\u4E2D\u7684\u52A8\u4F5C\u6216\u5F3A\u5236\u6062\u590D\u5176\u80CC\u666F\u3002\u89C6\u98911\u8D1F\u8D23\u672C\u6BB5\u52A8\u4F5C\u3001\u673A\u4F4D\u4E0E\u58F0\u97F3\u8854\u63A5\u3002
${content[0].text}`;
  }
  const body = { ...parseExtraParams(config) };
  body.model = model;
  body.content = content;
  body.duration = seconds;
  body.ratio = args.ratio || ref(config, "ratio", "adaptive");
  body.resolution = resolveResolution(config, args);
  const generateAudio = args.generateAudio ?? ref(config, "generateAudio", true);
  if (typeof generateAudio === "boolean") body.generate_audio = generateAudio;
  const watermark = args.watermark ?? ref(config, "watermark", false);
  if (typeof watermark === "boolean") body.watermark = watermark;
  if (args.user) body.safety_identifier = String(args.user);
  if (typeof args.returnLastFrame === "boolean") body.return_last_frame = args.returnLastFrame;
  if (args.seed != null && Number.isFinite(Number(args.seed))) body.seed = Number(args.seed);
  if (isOmniExtendModel(model)) {
    body.ratio = "adaptive";
    body.omni_reference_task_type = "extend";
  }
  return { body, seconds };
}
async function buildGenerationBody(config, args, seconds, options = {}) {
  const { refs } = validateImageRoles(args, resolveModel(config));
  const prompt = String(args.prompt ?? "").trim();
  const ratio = args.ratio || ref(config, "ratio", "adaptive");
  const canvas = canvasSize(ratio);
  const fit = canvas ? { size: canvas, config, signal: options.signal } : null;
  const content = [
    { type: "text", text: buildGenerationPrompt({ prompt, seconds, model: resolveModel(config) }) }
  ];
  const images = [];
  const notes = [];
  const addImage = async (value, role2, label) => {
    const resolved = isVolcengine(config) && /^asset:\/\//.test(String(value)) ? { url: String(value), source: "asset" } : await resolveImageInput(value, label, fit);
    content.push({
      type: "image_url",
      image_url: { url: resolved.url },
      role: role2
    });
    images.push({ role: role2, ...resolved });
  };
  const firstFrame = String(args.firstFrameUrl ?? "").trim();
  if (firstFrame) await addImage(firstFrame, "first_frame", "\u9996\u5E27\u56FE");
  const lastFrame = String(args.lastFrameUrl ?? "").trim();
  if (lastFrame) await addImage(lastFrame, "last_frame", "\u5C3E\u5E27\u56FE");
  for (const [index, reference] of refs.entries()) {
    await addImage(reference.trim(), "reference_image", `\u53C2\u8003\u56FE ${index + 1}`);
  }
  const body = { ...parseExtraParams(config) };
  body.model = resolveModel(config);
  body.content = content;
  body.duration = seconds;
  body.ratio = isOmniExtendModel(body.model) && content.some((item) => item.role === "first_frame" || item.role === "last_frame") ? "adaptive" : ratio;
  body.resolution = resolveResolution(config, args);
  const generateAudio = args.generateAudio ?? ref(config, "generateAudio", true);
  if (typeof generateAudio === "boolean") body.generate_audio = generateAudio;
  const watermark = args.watermark ?? ref(config, "watermark", false);
  if (typeof watermark === "boolean") body.watermark = watermark;
  if (args.user) body.safety_identifier = String(args.user);
  if (typeof args.returnLastFrame === "boolean") body.return_last_frame = args.returnLastFrame;
  if (args.seed != null && Number.isFinite(Number(args.seed))) body.seed = Number(args.seed);
  return { body, seconds, images, notes };
}
async function runTaskOnce(config, body, signal, progress = {}) {
  const created = progress.taskId ? null : await guardedSubmit(config, resolveSubmitPath(config), body, signal, progress.scope);
  const taskId = progress.taskId || extractTaskId(created);
  await appendRequestLog({ event: "task_created", taskId, model: body?.model, duration: body?.duration });
  if (!taskId) throw new Error("\u521B\u5EFA\u4EFB\u52A1\u5931\u8D25\uFF1A\u54CD\u5E94\u4E2D\u7F3A\u5C11\u4EFB\u52A1 ID\u3002");
  try {
    await progress.onCreated?.(taskId);
    const final = await timedStage("video_poll_wait", () => waitForCompletion(config, taskId, signal));
    if (["succeeded", "failed", "cancelled"].includes(final.status)) await finishSubmission(config, resolveSubmitPath(config), body);
    await appendRequestLog({ event: "task_finished", taskId, status: final.status, errorCode: final.errorCode });
    return { ...final, taskId };
  } catch (failure) {
    if (failure?.code === "ABORTED") return { taskId, status: "unknown", errorCode: "waiting_stopped", error: `\u5DF2\u505C\u6B62\u7B49\u5F85\uFF0C\u4EFB\u52A1 ${taskId} \u5DF2\u63D0\u4EA4\uFF0C\u53EF\u80FD\u4ECD\u5728\u751F\u6210\u3002\u7528 resume \u6216 video_status \u67E5\u8BE2\u5DF2\u6709\u4EFB\u52A1\uFF0C\u4E0D\u8981\u91CD\u65B0\u63D0\u4EA4\u3002` };
    return {
      taskId,
      status: "unknown",
      errorCode: failure?.code || "provider_poll_error",
      error: `\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF08${taskId}\uFF09\uFF0C\u4F46\u67E5\u8BE2\u72B6\u6001\u5931\u8D25\uFF1A${failure?.message || String(failure)}\u3002\u4EFB\u52A1\u53EF\u80FD\u4ECD\u5728\u751F\u6210\uFF0C\u53EF\u7528 video_status \u6309\u8FD9\u4E2A ID \u518D\u67E5\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u3002`
    };
  }
}
async function runTask(liveConfig, body, signal, progress = {}) {
  const config = snapshotConfig(liveConfig);
  const state = progress.state || {};
  const save2 = progress.saveState || (async () => {
  });
  if (!state.originalBody) {
    state.originalBody = body;
    await save2();
  }
  body = state.originalBody;
  const onCreated = (kind) => async (taskId) => {
    state[kind] = taskId;
    await save2();
    await progress.onCreated?.(taskId);
  };
  const failed = (error) => ({ status: error?.code === "submission_unknown" ? "submission_unknown" : "failed", submissionId: error?.submissionId, errorCode: error?.code || "provider_failed", error: error?.message || String(error) });
  if (state.phase === "review") {
    if (!progress.referenceImagesReviewed) {
      const result = failed(new Error("\u7B49\u5F85\u56FE\u7247\u6838\u5BF9"));
      setReferenceReview(result, state);
      return result;
    }
    if (!state.convertedBody) throw new Error("\u7F3A\u5C11\u8F6C\u6362\u7ED3\u679C\uFF0C\u4E0D\u80FD\u91CD\u8BD5\u89C6\u9891\u3002");
    state.phase = "retry";
    state.retryUsed = true;
    await save2();
  }
  if (state.retryUsed) {
    if (state.retryResult) return state.retryResult;
    try {
      const result = await runTaskOnce(config, state.convertedBody, signal, {
        taskId: state.retryTaskId,
        scope: progress.scope,
        onCreated: onCreated("retryTaskId")
      });
      if (["succeeded", "failed", "cancelled"].includes(result.status)) {
        state.retryResult = result;
        await save2();
      }
      return result;
    } catch (error) {
      const result = failed(error);
      if (error?.code !== "submission_unknown") {
        state.retryResult = result;
        await save2();
      }
      return result;
    }
  }
  if (state.originalResult?.status === "failed" && state.originalResult.errorCode !== "real_person_rejected") {
    delete state.originalResult;
    delete state.originalTaskId;
    await save2();
  }
  let final = state.originalResult;
  if (!final) {
    try {
      final = await runTaskOnce(config, body, signal, {
        taskId: state.originalTaskId || progress.taskId,
        scope: progress.scope,
        onCreated: onCreated("originalTaskId")
      });
    } catch (error) {
      if (error?.code === "submission_unknown") return failed(error);
      final = failed(error);
    }
    if (["succeeded", "failed", "cancelled"].includes(final.status)) {
      state.originalResult = { ...final };
      await save2();
    }
  }
  if (isVolcengine(config) || final.status !== "failed" || final.errorCode !== "real_person_rejected") return final;
  final = { ...final };
  await recoverRealPersonImages(config, body, progress.ctx, progress.exec, final, state, save2);
  return final;
}

// src/media/merge.ts
init_config();
init_connection();
import { rm as rm6, mkdir as mkdir8, writeFile as writeFile4, rename as rename6, stat as stat5, copyFile } from "node:fs/promises";
import path11 from "node:path";

// src/media/download.ts
import { mkdir as mkdir7, rename as rename5, rm as rm5 } from "node:fs/promises";
import path10 from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
var DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1e3;
async function downloadFile(url, destPath, { signal } = {}) {
  await mkdir7(path10.dirname(destPath), { recursive: true });
  const partial = `${destPath}.${uniqueSuffix("part")}`;
  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { signal: requestSignal });
    if (!response.ok) {
      throw Object.assign(new Error(`\u4E0B\u8F7D\u5206\u6BB5\u5931\u8D25\uFF08HTTP ${response.status}\uFF09\uFF1A${url}`), {
        code: "download_failed"
      });
    }
    if (!response.body) {
      throw Object.assign(new Error(`\u4E0B\u8F7D\u5206\u6BB5\u5931\u8D25\uFF1A\u54CD\u5E94\u6CA1\u6709\u5185\u5BB9\uFF08${url}\uFF09\u3002`), {
        code: "download_failed"
      });
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    await rename5(partial, destPath);
    return destPath;
  } catch (error) {
    await rm5(partial, { force: true }).catch(() => {
    });
    if (error?.code === "download_failed") throw error;
    if (signal?.aborted) throw abortError();
    throw Object.assign(new Error(`\u4E0B\u8F7D\u5206\u6BB5\u5931\u8D25\uFF1A${error?.message || error}\uFF08${url}\uFF09`), {
      code: "download_failed"
    });
  }
}

// src/media/merge.ts
function evenNumber(value, fallback) {
  const number2 = Number(value);
  if (!Number.isFinite(number2) || number2 <= 0) return fallback;
  const rounded = Math.round(number2);
  const even = rounded % 2 === 0 ? rounded : rounded - 1;
  return even >= 2 ? even : 2;
}
var AUDIO_PADDING_TOLERANCE_FRAMES = 1;
async function alignSegmentAudio(config, files, probed, outPath, { signal, binary } = {}) {
  const temps = [];
  const trimmed = [];
  const aligned = [];
  for (const [index, file] of files.entries()) {
    const media = probed?.[index];
    const fps = Math.max(1, Math.round(media?.fps || 30));
    const videoSeconds = Number(media?.videoDurationSeconds) || 0;
    const audioSeconds = Number(media?.audioDurationSeconds) || 0;
    const padding = audioSeconds - videoSeconds;
    const isLast = index === files.length - 1;
    if (isLast || !media?.hasAudio || videoSeconds <= 0 || padding <= AUDIO_PADDING_TOLERANCE_FRAMES / fps) {
      aligned.push(file);
      continue;
    }
    const temp = `${outPath}.${uniqueSuffix(`align${index + 1}`)}.mp4`;
    const { code } = await runProcess(
      binary || resolveBinary(config, "ffmpegBinary", "ffmpeg"),
      [
        "-y",
        "-i",
        file,
        "-map",
        "0:v",
        "-map",
        "0:a",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-af",
        `atrim=0:${videoSeconds.toFixed(3)}`,
        "-movflags",
        "+faststart",
        temp
      ],
      { signal }
    );
    if (code === 0 && await exists(temp)) {
      temps.push(temp);
      trimmed.push({ index: index + 1, paddingSeconds: Number(padding.toFixed(3)) });
      aligned.push(temp);
    } else {
      await rm6(temp, { force: true });
      aligned.push(file);
    }
  }
  return { files: aligned, temps, trimmed };
}
async function cleanupSegmentTemps(temps) {
  for (const temp of temps || []) await rm6(temp, { force: true });
}
async function mergeClips(config, files, outPath, { signal } = {}) {
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  await mkdir8(path11.dirname(outPath), { recursive: true });
  await rm6(outPath, { force: true });
  const work = `${outPath}.${uniqueSuffix("work")}.mp4`;
  let copyError = "";
  let audioError = "";
  const probed = [];
  for (const file of files) probed.push(await probeMedia(file, config, signal));
  const videos = probed.filter((media) => media && media.width && media.height);
  const paramsMatch = videos.length !== probed.length || videos.every((media) => media.width === videos[0].width && media.height === videos[0].height);
  const { files: aligned, temps, trimmed } = await alignSegmentAudio(
    config,
    files,
    probed,
    work,
    { signal, binary }
  );
  files = aligned;
  try {
    const mergeMode = ref(config, "mergeMode", "copy");
    if (mergeMode !== "reencode" && paramsMatch) {
      const listPath = `${work}.concat.txt`;
      const lines = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
      await writeFile4(listPath, `${lines}
`, "utf8");
      try {
        const { code: code2, stderr: stderr2 } = await runProcess(binary, [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          work
        ], { signal });
        if (code2 === 0 && await exists(work)) {
          await rename6(work, outPath);
          return { path: outPath, mode: "copy", trimmed };
        }
        copyError = stderr2.trim().slice(-400);
      } finally {
        await rm6(listPath, { force: true });
      }
    } else if (!paramsMatch) {
      copyError = "\u5206\u6BB5\u5206\u8FA8\u7387\u4E0D\u4E00\u81F4\uFF0C\u8DF3\u8FC7\u65E0\u635F\u62FC\u63A5\u3002";
    }
    const first = probed.find((media) => media && media.width && media.height) || {};
    const width = evenNumber(first.width, 1280);
    const height = evenNumber(first.height, 720);
    const fps = Math.min(60, Math.max(24, Math.round(first.fps || 30)));
    const withAudio = probed.length > 0 && probed.every((media) => media?.hasAudio);
    const videoParts = files.map((_, index) => `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${index}]`);
    const videoInputs = files.map((_, index) => `[v${index}]`).join("");
    async function encode(filter2, maps, withAudioTrack) {
      await rm6(work, { force: true });
      const args = ["-y"];
      for (const file of files) args.push("-i", file);
      args.push("-filter_complex", filter2, ...maps, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p");
      if (withAudioTrack) args.push("-c:a", "aac", "-b:a", "192k");
      args.push("-movflags", "+faststart", work);
      return runProcess(binary, args, { signal });
    }
    if (withAudio) {
      const audioParts = files.map((_, index) => `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${index}]`);
      const pairedInputs = files.map((_, index) => `[v${index}][a${index}]`).join("");
      const filter2 = [
        ...videoParts,
        ...audioParts,
        `${pairedInputs}concat=n=${files.length}:v=1:a=1[v][a]`
      ].join(";");
      const { code: code2, stderr: stderr2 } = await encode(filter2, ["-map", "[v]", "-map", "[a]"], true);
      if (code2 === 0 && await exists(work)) {
        await rename6(work, outPath);
        return { path: outPath, mode: "reencode", trimmed };
      }
      audioError = stderr2.trim().slice(-400);
    }
    const filter = [...videoParts, `${videoInputs}concat=n=${files.length}:v=1:a=0[v]`].join(";");
    const { code, stderr } = await encode(filter, ["-map", "[v]"], false);
    if (code === 0 && await exists(work)) {
      await rename6(work, outPath);
      return { path: outPath, mode: withAudio ? "reencode-video-only" : "reencode", trimmed };
    }
    const detail = [copyError, audioError, stderr.trim().slice(-400)].filter(Boolean).join(" | ");
    throw Object.assign(new Error(`ffmpeg \u5408\u5E76\u5931\u8D25\uFF1A${detail || "\u672A\u77E5\u9519\u8BEF"}`), { code: "ffmpeg_failed" });
  } finally {
    await cleanupSegmentTemps([...temps, work]);
  }
}
async function prepareSeamTrims(config, files, outPath, { signal } = {}) {
  const requested = ref(config, "seamTrimSeconds", "");
  const trims = String(requested || "").trim() ? String(requested).split(",").map((value) => Number(value.trim())) : [];
  if (trims.some((value) => !Number.isFinite(value) || value < 0 || value > 3)) {
    throw new Error("seamTrimSeconds \u5FC5\u987B\u4E3A\u9017\u53F7\u5206\u9694\u7684 0\u20133 \u79D2\u6570\u503C\uFF0C\u4F8B\u5982 0.5,0\uFF1B\u5206\u522B\u5BF9\u5E94\u7B2C 2\u30013 \u6BB5\u5F00\u5934\u3002");
  }
  const prepared = [...files];
  const temps = [];
  const cuts = [];
  try {
    for (let index = 0; index < files.length; index++) {
      const official = !isOmniExtendModel(resolveModel(config)) && files.length > 1 && !trims.length;
      const secondsRequested = index > 0 ? trims[index - 1] || 0 : 0;
      if (!official && !secondsRequested) continue;
      const media = await probeMedia(files[index], config, signal);
      const duration = Number(media?.videoDurationSeconds || media?.durationSeconds);
      const fps = Number(media?.fps) || 24;
      const seconds = official ? index > 0 ? 1 / fps : 0 : secondsRequested;
      const tailSeconds = official && index < files.length - 1 ? 6 / fps : 0;
      const keptSeconds = duration - seconds - tailSeconds;
      if (!(keptSeconds > 0.5)) throw new Error(`\u7B2C ${index + 1} \u6BB5\u88C1\u526A\u540E\u4E0D\u8DB3 0.5 \u79D2\uFF0C\u5DF2\u505C\u6B62\u5408\u5E76\u3002`);
      const temp = `${outPath}.${uniqueSuffix(`cut${index + 1}`)}.mp4`;
      temps.push(temp);
      const result = await runProcess(resolveBinary(config, "ffmpegBinary", "ffmpeg"), [
        "-y",
        "-i",
        files[index],
        "-ss",
        String(seconds),
        "-t",
        String(keptSeconds),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        temp
      ], { signal });
      if (result.code !== 0) throw new Error(`\u7B2C ${index + 1} \u6BB5\u63A5\u7F1D\u88C1\u526A\u5931\u8D25\uFF1A${tail(result.stderr)}`);
      prepared[index] = temp;
      cuts.push({ index: index + 1, seconds, tailSeconds });
    }
    return { files: prepared, temps, cuts };
  } catch (error) {
    await cleanupSegmentTemps(temps);
    throw error;
  }
}
async function downloadSegmentsAndMerge(config, {
  segments,
  segmentsDir,
  outDir,
  stamp,
  notes = [],
  keepSingleFile = false,
  signal
}) {
  const files = [];
  const deliveredSeconds = segments.reduce((sum, item) => sum + (item.seconds || 0), 0);
  const ffmpegReady = segments.length > 1 ? await hasFfmpeg(config, signal) : true;
  let probeWarned = false;
  for (const [index, segment] of segments.entries()) {
    const dest = path11.join(
      segmentsDir,
      `${String(segment.index).padStart(2, "0")}-${segment.kind}.mp4`
    );
    try {
      if (!await exists(dest)) {
        await timedStage("segment_download", () => downloadFile(segment.videoUrl, dest, { signal }));
      }
    } catch (failure) {
      if (failure?.code === "ABORTED") throw failure;
      const reason = `\u5206\u6BB5\u5DF2\u751F\u6210\uFF0C\u4F46\u4E0B\u8F7D\u5931\u8D25\uFF1A${failure?.message || failure}`;
      notes.push(reason);
      return { files, segmentsDir, deliveredSeconds, error: reason };
    }
    segment.localPath = dest;
    await appendRequestLog({
      event: "segment_saved",
      index: segment.index,
      taskId: segment.taskId,
      path: dest,
      bytes: (await stat5(dest)).size
    });
    const media = await timedStage("segment_probe", () => probeMedia(dest, config, signal));
    if (media?.durationSeconds) {
      segment.durationSeconds = Number(media.durationSeconds.toFixed(2));
      const cumulative = segments.slice(0, index + 1).reduce((sum, item) => sum + (item.seconds || 0), 0);
      const tolerance = Math.max(
        CUMULATIVE_TOLERANCE_MIN_SECONDS,
        cumulative * CUMULATIVE_TOLERANCE_RATIO
      );
      const looksCumulative = files.length > 0 && Math.abs(media.durationSeconds - cumulative) <= tolerance && Math.abs(media.durationSeconds - segment.seconds) > tolerance;
      if (looksCumulative) {
        await appendRequestLog({ event: "cumulative_output_detected", index: segment.index, duration: media.durationSeconds, plannedCumulative: cumulative });
        files.length = 0;
        notes.push(
          `\u7B2C ${segment.index} \u6BB5\u5B9E\u6D4B ${formatSeconds(media.durationSeconds)} \u79D2\uFF0C\u63A5\u8FD1\u7D2F\u8BA1\u65F6\u957F ${cumulative} \u79D2\uFF0C\u6309\u300C\u4E0A\u6E38\u8FD4\u56DE\u7684\u662F\u7D2F\u8BA1\u6210\u7247\u300D\u5904\u7406\u3002`
        );
      }
    } else if (!probeWarned) {
      probeWarned = true;
      notes.push("\u6CA1\u6709\u53EF\u7528\u7684 ffprobe\uFF0C\u65E0\u6CD5\u63A2\u6D4B\u5206\u6BB5\u65F6\u957F\uFF0C\u6309\u300C\u6BCF\u6BB5\u90FD\u662F\u589E\u91CF\u7247\u6BB5\u300D\u76F4\u63A5\u62FC\u63A5\u3002");
    }
    files.push(dest);
  }
  if (!files.length) return { files, segmentsDir, deliveredSeconds };
  if (!ffmpegReady && files.length > 1) {
    const guide = ffmpegInstallHint(config);
    notes.push(`\u5206\u6BB5\u6587\u4EF6\u90FD\u5DF2\u4E0B\u8F7D\u5230 ${segmentsDir}\u3002`);
    notes.push(guide.hint);
    return {
      files,
      segmentsDir,
      deliveredSeconds,
      merged: false,
      ffmpegMissing: true,
      installHint: guide.hint
    };
  }
  const finalPath = path11.join(outDir, `${stamp}-${deliveredSeconds}s.mp4`);
  try {
    if (files.length === 1 && keepSingleFile) {
      return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: "segment", videoPath: files[0] };
    }
    if (files.length === 1) {
      await mkdir8(path11.dirname(finalPath), { recursive: true });
      await rm6(finalPath, { force: true });
      await copyFile(files[0], finalPath);
      await appendRequestLog({ event: "delivery_copied", sourcePath: files[0], videoPath: finalPath });
      return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: "single", videoPath: finalPath };
    }
    await appendRequestLog({ event: "merge_started", inputPaths: files, videoPath: finalPath });
    const prepared = await timedStage("seam_prepare", () => prepareSeamTrims(config, files, finalPath, { signal }));
    await appendRequestLog({ event: "seam_trims_prepared", cuts: prepared.cuts });
    let merged;
    try {
      merged = await timedStage("video_merge", () => mergeClips(config, prepared.files, finalPath, { signal }));
    } finally {
      await cleanupSegmentTemps(prepared.temps);
    }
    if (prepared.cuts.length) {
      notes.push(`\u5DF2\u6309${String(ref(config, "seamTrimSeconds", "")).trim() ? "\u624B\u52A8\u8BBE\u7F6E" : "\u6A21\u578B\u9ED8\u8BA4\u7B56\u7565"}\u88C1\u526A\u63A5\u7F1D\uFF1A${prepared.cuts.map((cut) => `\u7B2C ${cut.index} \u6BB5\uFF1A\u5934\u90E8 ${cut.seconds.toFixed(3)} \u79D2\u3001\u5C3E\u90E8 ${cut.tailSeconds.toFixed(3)} \u79D2`).join("\uFF1B")}\u3002\u539F\u59CB\u5206\u6BB5\u672A\u6539\u52A8\uFF1B\u5B9E\u9645\u6210\u7247\u4F1A\u7F29\u77ED\uFF0C\u4E0D\u8865\u5E27\u51D1\u65F6\u957F\u3002`);
    }
    const actual = await probeMedia(finalPath, config, signal);
    await appendRequestLog({
      event: "merge_completed",
      videoPath: finalPath,
      mode: merged.mode,
      actualSeconds: actual?.durationSeconds,
      sourceCount: segments.length
    });
    if (merged.trimmed?.length) {
      notes.push(
        `\u7B2C ${merged.trimmed.map((item) => item.index).join("\u3001")} \u6BB5\u7684\u97F3\u9891\u6BD4\u89C6\u9891\u957F\uFF08\u6700\u957F ${Math.max(...merged.trimmed.map((item) => item.paddingSeconds))} \u79D2\uFF09\uFF0C\u5DF2\u88C1\u9F50\u540E\u518D\u62FC\u63A5\uFF0C\u907F\u514D\u63A5\u7F1D\u5904\u7F3A\u4E00\u5C0F\u6BB5\u753B\u9762\u3002`
      );
    }
    return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: merged.mode, videoPath: finalPath, seamCuts: prepared.cuts, actualSeconds: actual?.durationSeconds };
  } catch (failure) {
    if (failure?.code === "ABORTED") throw failure;
    let reason = `\u5206\u6BB5\u5DF2\u751F\u6210\uFF0C\u4F46\u5408\u5E76\u5931\u8D25\uFF1A${failure?.message || failure}`;
    let installHint;
    if (failure?.code === "ffmpeg_missing") {
      const guide = ffmpegInstallHint(config);
      installHint = guide.hint;
      reason = guide.hint;
    }
    notes.push(reason);
    await appendRequestLog({ event: "merge_failed", errorCode: String(failure?.code || "merge_error"), segmentsDir });
    return { files, segmentsDir, deliveredSeconds, error: reason, ffmpegMissing: Boolean(installHint), installHint };
  }
}

// src/tools/video-generate.ts
function videoTool(liveConfig, deps, ctx) {
  const config = liveConfig;
  const TOOL_NAME = "video_generate";
  return {
    name: "video_generate",
    description: `\u751F\u6210\u4E00\u6BB5\u5B8C\u6574\u89C6\u9891\uFF08\u89C6\u9891\u751F\u6210\u7684\u9996\u9009\u5DE5\u5177\uFF09\uFF0Cduration \u662F\u76EE\u6807\u603B\u79D2\u6570\uFF1A\u4E0D\u8D85\u8FC7\u6A21\u578B\u5355\u6BB5\u4E0A\u9650\uFF082.0 \u4E3A 15 \u79D2\u30012.5 \u4E3A 30 \u79D2\uFF09\u65F6\u4E00\u6B21\u76F4\u51FA\uFF1B**\u786C\u89C4\u5219\uFF1A\u603B\u65F6\u957F \u2264 \u5355\u6BB5\u4E0A\u9650\u7684\u89C6\u9891\u5FC5\u987B\u4E00\u6B21\u76F4\u51FA\uFF0C\u7981\u6B62\u62C6\u6210\u591A\u6BB5 / \u591A\u955C / \u591A\u6B21\u8C03\u7528\u518D\u62FC\u63A5**\uFF08\u4F8B\u5982\u300C15 \u79D2\u300D\u4E0D\u8BB8\u62C6\u6210 8+7\uFF09\uFF1B\u6309\u6545\u4E8B\u9009\u62E9\u4E00\u955C\u5230\u5E95\u6216\u5C11\u91CF\u6709\u52A8\u673A\u7684\u5207\u955C\uFF0C\u5E76\u5199\u5165\u5F85\u5BA1\u6838\u811A\u672C\uFF1B\u53D9\u4E8B\u5207\u955C\u4E0D\u7B49\u4E8E\u62C6\u5206\u751F\u6210\u4EFB\u52A1\u3002\u66F4\u957F\u65F6\u5148\u76F4\u51FA\u9996\u6BB5\uFF0C\u518D\u628A\u5269\u4F59\u65F6\u957F\u6309 4 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09 \u79D2\u5747\u5206\u9010\u6BB5\u7EED\u62CD\uFF08\u9ED8\u8BA4\u5403\u6EE1\u4E0A\u9650\u3001\u6BB5\u6570\u6700\u5C11\uFF0C\u6700\u957F ${MAX_TOTAL_SECONDS} \u79D2\uFF09\u2014\u2014\u8FD9\u662F\u8FDE\u7EED\u5267\u60C5\u7684\u7EED\u62CD\u5EF6\u957F\uFF0C\u751F\u6210\u5206\u6BB5\u672C\u8EAB\u4E0D\u4EE3\u8868\u53D9\u4E8B\u5207\u955C\uFF0C\u6700\u540E\u7528 ffmpeg \u5408\u5E76\u6210\u4E00\u4E2A\u672C\u5730\u6210\u7247\u6587\u4EF6\uFF0C\u9ED8\u8BA4\u843D\u5728\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/\uFF0C\u6587\u4EF6\u540D\u5F62\u5982 20261027-201530-25s.mp4\u300220 \u79D2\u300125 \u79D2\u8FD9\u7C7B\u76EE\u6807\u4E0D\u7528\u62C6\u6210\u591A\u4E2A\u4EFB\u52A1\uFF1A\u76F4\u63A5\u4F20 duration=20 \u5373\u53EF\uFF0820 \u79D2 \u2192 15+5\uFF0C25 \u79D2 \u2192 15+10\uFF09\u3002**\u6BCF\u6BB5\u751F\u6210\u5B8C\u5148\u8FD4\u56DE\u89C6\u9891\u4F9B\u9884\u89C8**\uFF1A\u5148\u5C55\u793A\u6210\u679C\uFF0C\u518D\u8BE2\u95EE\u662F\u5426\u7EE7\u7EED\uFF1B\u672A\u786E\u8BA4\u5C31\u505C\u4E0B\uFF0C\u5148\u628A\u5DF2\u7ECF\u751F\u6210\u7684\u90E8\u5206\u4EA4\u4ED8\uFF0C\u7ED3\u679C\u91CC\u5E26 paused=true\u3001resumeDir \u548C remainingSeconds\uFF1B\u4E4B\u540E\u7528\u6237\u8BF4\u300C\u7EE7\u7EED\u300D\u65F6\uFF0C\u628A resumeDir \u539F\u6837\u4F20\u7ED9 video_generate \u7684 resume \u53C2\u6570\u63A5\u7740\u505A\uFF08\u524D\u9762\u51E0\u6BB5\u4E0D\u91CD\u65B0\u751F\u6210\u3001\u4E0D\u91CD\u590D\u6263\u8D39\uFF09\uFF0C\u4E0D\u8981\u4ECE\u5934\u518D\u751F\u6210\u4E00\u904D\u3001\u4E5F\u4E0D\u8981\u6539\u7528 video_extend \u62FC\u3002\u6BCF\u6B21\u8C03\u7528\u6700\u591A\u5B8C\u6210\u5F53\u524D\u4E00\u6BB5\uFF1B\u540E\u7EED\u5FC5\u987B\u4F7F\u7528resume\uFF0C\u4E0D\u91CD\u65B0\u521B\u5EFA\u9996\u6BB5\u4EFB\u52A1\u3002\u8FD4\u56DE\u6BCF\u6BB5\u4EFB\u52A1 ID\u3001\u4E0A\u6E38\u94FE\u63A5\u548C\u6210\u7247\u8DEF\u5F84\u3002\u751F\u6210\u901A\u5E38\u9700\u8981\u51E0\u5206\u949F\uFF08\u6BCF\u6BB5\u5355\u72EC\u751F\u6210\uFF09\uFF0C\u5355\u6B21\u8C03\u7528\u8FD4\u56DE timeout\u3001\u6216\u67D0\u6BB5\u8FD4\u56DE unknown\uFF08\u67E5\u8BE2\u5931\u8D25\u3001\u4EFB\u52A1\u5176\u5B9E\u5DF2\u63D0\u4EA4\uFF09\u65F6\uFF0C\u90FD\u7528\u8FD4\u56DE\u7684\u4EFB\u52A1 ID \u8D70 video_status \u7EE7\u7EED\u7B49\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u65B0\u4EFB\u52A1\u2014\u2014\u91CD\u590D\u63D0\u4EA4\u4F1A\u91CD\u590D\u6263\u8D39\uFF0C\u67E5\u8BE2\u5931\u8D25\u4E0D\u4EE3\u8868\u6CA1\u6709\u751F\u6210\u3002**\u8C03\u7528\u524D\u5FC5\u987B\u5148\u5B8C\u6574\u5C55\u793A\u5F53\u524D\u7248\u811A\u672C\u3001\u518D\u8BA9\u7528\u6237\u5BA1\u6838\u901A\u8FC7\uFF0C\u5E76\u786E\u8BA4\u5F00\u59CB\u5236\u4F5C**\uFF08\u4E24\u9053\u786E\u8BA4\u7F3A\u4E00\u4E0D\u53EF\uFF09\uFF0C\u4E0D\u8981\u8DF3\u8FC7\u811A\u672C\u76F4\u63A5\u751F\u6210\u3002\u5408\u5E76\u9700\u8981\u672C\u673A\u6709 ffmpeg\u3002\u672C\u673A\u6CA1\u88C5 ffmpeg \u65F6\uFF0C\u63D2\u4EF6\u4F1A**\u5148\u628A\u8FD9\u6B21\u8C03\u7528\u62E6\u56DE\u6765\uFF08\u4E0D\u4F1A\u8C03\u7528\u6A21\u578B\u3001\u4E0D\u4EA7\u751F\u8D39\u7528\uFF09**\uFF0C\u8FD4\u56DE\u7684\u8BF4\u660E\u91CC\u5E26\u7740\u6309\u7CFB\u7EDF\u7ED9\u7684\u5B89\u88C5\u547D\u4EE4 \u2014\u2014\u8FD9\u65F6\u8981\u5728\u5BF9\u8BDD\u6846\u91CC\u548C\u7528\u6237\u786E\u8BA4\uFF1A\u95EE\u4ED6\u8981\u4E0D\u8981\u73B0\u5728\u88C5 ffmpeg\uFF08\u7ED9\u51FA\u4ED6\u7CFB\u7EDF\u7684\u547D\u4EE4\uFF0C\u8BF4\u660E\u88C5\u597D\u91CD\u8DD1\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\u3001\u5206\u6BB5\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\uFF0C\u540C\u610F\u5C31\u8C03\u7528 video_setup\uFF08install:true\uFF09\uFF0C\u5BBF\u4E3B\u786E\u8BA4\u540E\u5B89\u88C5\u5E76\u81EA\u52A8\u9A8C\u8BC1\uFF0C\u7136\u540E\u6309\u540C\u6837\u7684 duration \u91CD\u53D1\uFF1B\u7528\u6237\u4E0D\u60F3\u88C5\u5C31\u5E26 merge:false \u91CD\u53D1\uFF0C\u63D2\u4EF6\u53EA\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF08\u6BCF\u6BB5\u4E0A\u6E38\u94FE\u63A5 + \u672C\u5730\u6587\u4EF6\uFF09\u3002\u62FF\u5230 ffmpegMissing=true \u7684\u7ED3\u679C\u65F6\u4E5F\u8981\u7167 installHint \u5F15\u5BFC\u5B89\u88C5\uFF0C\u522B\u53EA\u4E22\u4E00\u53E5\u300C\u5DF2\u8DF3\u8FC7\u5408\u5E76\u300D\u3002**\u4EBA\u7269\u5F62\u8C61 / \u53C2\u8003\u56FE**\uFF1A\u516C\u7F51\u56FE\u7247 URL\u3001base64\uFF08data URI \u6216\u7EAF base64\uFF09\u3001\u672C\u673A\u56FE\u7247\u8DEF\u5F84\uFF0C\u6216\u7B80\u5199 \`latest\` \u90FD\u652F\u6301\u2014\u2014\u8981\u56FA\u5B9A\u4EBA\u7269\u957F\u76F8\u3001\u670D\u88C5\u3001\u573A\u666F\u65F6\u4F20 referenceImages\uFF0C\u6309\u6570\u7EC4\u987A\u5E8F\u9010\u5F20\u63D0\u4EA4\u5E76\u4EE5\u56FE\u72471\u3001\u56FE\u72472\u7B49\u6307\u4EE3\uFF1B\u9996\u5E27 / \u5C3E\u5E27\u7528 firstFrameUrl / lastFrameUrl \u4F20\u3002\u516C\u7F51 URL \u76F4\u63A5\u4EA4\u7ED9\u4E2D\u8F6C\u7AD9\u53D6\u56FE\uFF1B\u672C\u5730\u56FE\u7247\u7531\u63D2\u4EF6\u8BFB\u8FDB\u6765\uFF08\u6309 ratio \u5148\u9002\u914D\u753B\u5E45\uFF09\u5185\u8054\u6210 image_url \u53D1\u7ED9\u4E2D\u8F6C\u7AD9\uFF0C\u7528\u6237\u4E0D\u9700\u8981\u81EA\u5DF1\u627E\u56FE\u5E8A\u3002**\u7528\u6237\u8BF4\u300C\u5C31\u7528\u6211\u521A\u4E0A\u4F20/\u521A\u62D6\u8FDB\u6765\u7684\u90A3\u5F20\u56FE\u300D\u65F6\u76F4\u63A5\u4F20 \`latest\`**\uFF08\`latest:2\` \u53D6\u7B2C 2 \u65B0\u7684\uFF09\uFF1A\u63D2\u4EF6\u4F1A\u53BB Harness \u9644\u4EF6\u5E93\u91CC\u627E\u6700\u8FD1 2 \u5C0F\u65F6\u4E0A\u4F20\u7684\u56FE\u7247\u2014\u2014\u54EA\u6015\u5F53\u524D\u804A\u5929\u6A21\u578B\u4E0D\u652F\u6301\u56FE\u7247\u3001\u9644\u4EF6\u88AB \`MODEL_DOES_NOT_SUPPORT_IMAGES\` \u62E6\u4E0B\uFF0C\u56FE\u7247\u672C\u8EAB\u4E5F\u5DF2\u7ECF\u843D\u76D8\uFF0C\u7167\u6837\u80FD\u7528\u3002\u522B\u5728\u8FD9\u65F6\u8BF4\u300C\u6211\u770B\u4E0D\u5230\u56FE\u7247\u300D\uFF0C\u4E5F\u522B\u8BA9\u7528\u6237\u81EA\u5DF1\u53BB\u627E\u8DEF\u5F84\u3002`,
    parameters: {
      type: "object",
      properties: {
        resetCharacterChoice: { type: "boolean", description: "\u4EC5\u5728\u7528\u6237\u660E\u786E\u6539\u53D8\u5DF2\u786E\u8BA4\u7684\u89D2\u8272\u56FE\u65B9\u6848\u65F6\u8BBEtrue\uFF0C\u91CD\u65B0\u5F39\u51FA\u9009\u62E9\uFF1B\u4E0D\u4F1A\u76F4\u63A5\u6539\u4E3A\u7EAF\u6587\u751F\uFF0C\u4E5F\u4E0D\u80FD\u7ED5\u8FC7\u786E\u8BA4\u3002" },
        characterReferenceImages: { type: "array", items: { type: "string" }, description: "\u5DF2\u5BA1\u6838\u7684\u6700\u521D\u89D2\u8272\u53C2\u8003\u56FE\uFF0C\u6309\u56FA\u5B9A\u987A\u5E8F\u7528\u4E8E\u6BCF\u6BB5\u7EED\u62CD\uFF1B\u672A\u63D0\u4F9B\u65F6\u6CBF\u7528\u9996\u6BB5\u53C2\u8003\u56FE\u6216\u9996\u5E27\u3002\u652F\u6301URL\u3001\u672C\u5730\u56FE\u7247\u6216data URI\u3002\u65AD\u70B9\u56FA\u5B9A\u6B64\u5957\u56FE\uFF0C\u4E0D\u81EA\u52A8\u91CD\u753B\u6216\u66FF\u6362\u3002\u771F\u4EBA\u8F6C\u6362\u4ECD\u9700\u5355\u72EC\u540C\u610F\u53CA\u7ED3\u679C\u5BA1\u6838\u3002" },
        prompt: {
          type: "string",
          description: "\u7CBE\u7B80\u7684\u672C\u6BB5\u5185\u5BB9\u6216\u5168\u7247\u521B\u610F\u6982\u8981\uFF0C\u4E0D\u4F20\u5B8C\u6574\u5267\u672C\u3002\u8D85\u8FC7\u6A21\u578B\u4E0A\u9650\u65F6\u5FC5\u987B\u53E6\u4F20segmentPrompts\uFF0C\u6BCF\u6BB5\u5206\u522B\u5199\u65B0\u52A8\u4F5C\u4E0E\u5BF9\u767D\u3002"
        },
        duration: {
          type: "integer",
          minimum: 4,
          maximum: 120,
          description: `\u76EE\u6807\u603B\u65F6\u957F\uFF08\u79D2\uFF09\u3002\u4E0D\u8D85\u8FC7\u6A21\u578B\u5355\u6BB5\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09\u65F6\u5C31\u4E00\u6B21\u76F4\u51FA\uFF08\u6574\u6761\u89C6\u9891\u53EA\u751F\u6210\u4E00\u6B21\uFF0C\u7981\u6B62\u62C6\u6210\u591A\u6BB5/\u591A\u955C\u518D\u62FC\uFF09\uFF1B\u8D85\u8FC7\u5C31\u5148\u76F4\u51FA\u4E0A\u9650\u957F\u5EA6\u518D\u9010\u6BB5\u5EF6\u957F\uFF0C\u6700\u540E\u5408\u5E76\u3002\u5355\u6761\u6210\u7247\u6700\u957F ${MAX_TOTAL_SECONDS} \u79D2\uFF08\u6700\u591A ${MAX_SEGMENTS} \u6BB5\uFF09\uFF0C\u66F4\u957F\u7684\u76EE\u6807\u6309 ${MAX_TOTAL_SECONDS} \u79D2\u6267\u884C\u5E76\u5728 note \u91CC\u8BF4\u660E\uFF0C\u4E0D\u8981\u53CD\u590D\u91CD\u8BD5\u66F4\u5927\u7684\u65F6\u957F\u3002`
        },
        firstFrameUrl: {
          type: "string",
          description: "\u53EF\u9009\uFF1A\u9996\u5E27\u56FE\uFF0C\u516C\u7F51 URL\u3001base64 \u6216\u672C\u673A\u56FE\u7247\u8DEF\u5F84\uFF08\u542B\u5BF9\u8BDD\u91CC @ \u5F15\u7528\u7684\u4E0A\u4F20\u6587\u4EF6\uFF09\u90FD\u884C\uFF0C\u4F5C\u4E3A\u751F\u6210\u7684\u9996\u5E27\u53C2\u8003\uFF1B\u672C\u673A\u56FE\u7247\u4F1A\u6309 ratio \u5148\u9002\u914D\u5230\u76EE\u6807\u753B\u5E45\u518D\u63D0\u4EA4\u3002"
        },
        lastFrameUrl: {
          type: "string",
          description: "\u53EF\u9009\uFF1A\u5C3E\u5E27\u56FE\uFF0C\u516C\u7F51 URL\u3001base64 \u6216\u672C\u673A\u56FE\u7247\u8DEF\u5F84\u90FD\u884C\uFF0C\u4F5C\u4E3A\u751F\u6210\u7684\u5C3E\u5E27\u53C2\u8003\u3002"
        },
        segmentPrompts: {
          type: "array",
          items: { type: "string", minLength: 1 },
          description: "\u591A\u6BB5\u751F\u6210\u5FC5\u987B\u63D0\u4F9B\uFF1A\u6309\u5B8C\u6574\u8BA1\u5212\u987A\u5E8F\uFF0C\u6BCF\u6BB5\u4E00\u6761\u72EC\u7ACB\u63D0\u793A\u8BCD\uFF0C\u542B\u7A33\u5B9A\u4E3B\u4F53\u6807\u7B7E\u3001\u52A8\u4F5C\u8D77\u6B62\u72B6\u6001\u3001\u672C\u6BB5\u65B0\u5BF9\u767D\u548C\u8FD0\u955C\u30022.0\u6309\u4E8B\u4EF6\u987A\u5E8F\uFF1B2.5\u53EF\u7528\u672C\u6BB5\u4ECE0\u79D2\u8D77\u7684\u8FDE\u7EED\u65F6\u95F4\u533A\u95F4\u3002\u7EED\u62CD\u6BB5\u53E6\u542B\u5355\u884C\u3010\u8FC7\u6E21\u753B\u9762\u3011\u63CF\u8FF0\u4E0A\u4E00\u6BB5\u5230\u672C\u6BB5\u7684\u52A8\u4F5C\u3001\u955C\u5934\u4E0E\u58F0\u97F3\u4EA4\u63A5\uFF1B\u7EED\u505A\u9ED8\u8BA4\u6CBF\u7528\u539F\u6570\u7EC4\uFF0C\u4E0D\u4F20\u6574\u4EFD\u5267\u672C\u66FF\u4EE3\u6BCF\u6BB5\u3002"
        },
        referenceImages: {
          type: "array",
          items: { type: "string" },
          description: "\u53EF\u9009\uFF1A\u4EBA\u7269\u5F62\u8C61 / \u4E3B\u4F53\u53C2\u8003\u56FE\uFF08\u6BCF\u9879\u662F\u516C\u7F51 URL\u3001base64\uFF08data URI \u6216\u7EAF base64\uFF09\u3001\u672C\u673A\u56FE\u7247\u8DEF\u5F84\uFF0C\u6216 `latest` / `latest:2` \u8FD9\u79CD\u300C\u7528\u6237\u6700\u8FD1\u4E0A\u4F20\u7684\u56FE\u7247\u300D\u7B80\u5199\uFF09\u3002\u60F3\u628A\u67D0\u4E2A\u4EBA\u7684\u957F\u76F8\u3001\u53D1\u578B\u3001\u670D\u88C5\u56FA\u5B9A\u4E0B\u6765\u65F6\u7528\u5B83\uFF0C\u56FE\u7247\u4EE5 role=reference_image \u4F20\u7ED9\u4E0A\u6E38\u3002\u4E09\u79CD\u63A5\u5165\u65B9\u5F0F\u5747\u6309\u987A\u5E8F\u63D0\u4EA4\u5168\u90E8\u53C2\u8003\u56FE\uFF1A2.0\u6700\u591A9\u5F20\u30012.5\u6700\u591A30\u5F20\uFF0C\u4E0D\u80FD\u4E0E\u9996\u5C3E\u5E27\u6DF7\u7528\uFF1B\u4E2D\u8F6C\u9700\u652F\u6301\u539F\u751Fcontent\u89D2\u8272\u683C\u5F0F\u3002C\u706B\u5C71\u76F4\u8FDE\u53E6\u652F\u6301asset://\u7D20\u6750\u3002\u672C\u5730\u56FE\u7247\u5355\u5F20\u4E0D\u8D85\u8FC7 8 MB\uFF0C\u652F\u6301 jpg/jpeg/png/webp/bmp/gif/tiff\u3002"
        },
        segmentSeconds: {
          type: "integer",
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description: "\u4EC5\u5728\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\u65F6\u624D\u7528\uFF1A\u6BCF\u6BB5\u5EF6\u957F\u591A\u5C11\u79D2\uFF0C\u9ED8\u8BA4\u7528\u914D\u7F6E\u91CC\u7684\u6BCF\u6BB5\u79D2\u6570\uFF1B4 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09 \u7684\u6574\u6570\uFF08\u5982 5/8/10/14\uFF09\uFF0C\u9ED8\u8BA4\u6309\u6A21\u578B\u4E0A\u9650\uFF1A\u6309\u4E0A\u9650\u62C6\u3001\u6BB5\u6570\u6700\u5C11\u3002"
        },
        transitionDescription: {
          type: "string",
          description: "\u5DF2\u5BA1\u6838\u7684\u7EED\u62CD\u8FC7\u6E21\u63CF\u8FF0\uFF1A\u89C6\u98911\u63A5\u7F1D\u72B6\u6001\u2192\u672C\u6BB5\u52A8\u4F5C/\u955C\u5934\u8854\u63A5\u2192\u58F0\u97F3\u5EF6\u7EED\uFF0C\u76F4\u63A5\u4F7F\u7528\u201C\u89C6\u98911\u201D\uFF0C\u4E0D\u5199\u201C\u53C2\u8003\u89C6\u98911\u201D\u3002\u591A\u6BB5\u5171\u7528\u65F6\u4F5C\u4E3A\u901A\u7528\u63CF\u8FF0\uFF1Bvideo_generate \u53EF\u5728\u5404\u6761 segmentPrompts \u5185\u7528\u5355\u884C\u3010\u8FC7\u6E21\u753B\u9762\u3011\u6307\u5B9A\u8BE5\u6BB5\u8FC7\u6E21\u5E76\u4F18\u5148\u91C7\u7528\u3002\u4EC5\u4F5C\u7528\u4E8E\u7EED\u62CD\uFF0C\u9996\u6B21\u76F4\u51FA\u4E0D\u5F15\u7528\u89C6\u98911\u3002"
        },
        mode: {
          type: "string",
          enum: ["continuous", "closeup"],
          description: "\u7531\u5DF2\u5BA1\u6838\u811A\u672C\u51B3\u5B9A\u672C\u6B21\u7EED\u62CD\uFF1Acontinuous=\u540C\u673A\u4F4D\u8FDE\u7EED\uFF08\u672A\u6307\u5B9A\u65F6\uFF09\uFF1Bcloseup=\u6309\u811A\u672C\u5728\u5B8C\u6574\u5BF9\u767D\u6216\u52A8\u4F5C\u7ED3\u675F\u540E\u5207\u955C\uFF0C\u5177\u4F53\u666F\u522B\u4EE5\u8FC7\u6E21\u63CF\u8FF0\u4E3A\u51C6\u3002"
        },
        ratio: {
          type: "string",
          enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
          description: "\u753B\u9762\u6BD4\u4F8B\uFF1Bseedance 2.5 \u5EF6\u957F\u65F6\u4F1A\u81EA\u52A8\u6539\u7528 adaptive\u3002"
        },
        generateAudio: {
          type: "boolean",
          description: "\u662F\u5426\u751F\u6210\u97F3\u9891\uFF0C\u9ED8\u8BA4 true\u3002"
        },
        watermark: {
          type: "boolean",
          description: "\u662F\u5426\u6DFB\u52A0\u6C34\u5370\uFF0C\u9ED8\u8BA4 false\u3002"
        },
        resolution: { type: "string", enum: ["480p", "720p"], description: "\u89C6\u9891\u6E05\u6670\u5EA6\uFF0C\u53EF\u9009 480P \u6216 720P\uFF1B\u6309\u7528\u6237\u786E\u8BA4\u7684\u811A\u672C\u663E\u5F0F\u4F20\u5165\uFF0C\u7EED\u505A\u672A\u6307\u5B9A\u65F6\u6CBF\u7528\u539F\u6E05\u6670\u5EA6\u3002" },
        referenceImagesReviewed: { type: "boolean", description: "\u4EC5\u5F53\u4E0A\u4E00\u8F6E\u8FD4\u56DE review_required\uFF0C\u5DF2\u5B9E\u9645\u5C55\u793A\u6240\u6709\u8F6C\u6362\u56FE\u7247\u4E14\u7528\u6237\u660E\u786E\u786E\u8BA4\u975E\u771F\u4EBA\u6548\u679C\u5E76\u540C\u610F\u89C6\u9891\u91CD\u8BD5\u540E\u4F20 true\uFF1B\u9996\u6B21\u8C03\u7528\u4E0D\u5F97\u9884\u5148\u8BBE\u7F6E\u3002" },
        resumeWithCurrentConfig: { type: "boolean", description: "\u4EC5\u5728\u7528\u6237\u660E\u786E\u786E\u8BA4\u66F4\u6362\u539F\u8FDB\u5EA6\u7684\u6A21\u578B\u6216\u63A5\u5165\u6E20\u9053\u540E\u8BBE\u4E3Atrue\uFF1B\u6709\u5F85\u67E5\u8BE2\u4EFB\u52A1\u65F6\u5FC5\u987B\u6062\u590D\u539F\u6E20\u9053\u3002" },
        resume: {
          type: "string",
          description: "\u63A5\u7740\u4E0A\u4E00\u6B21\u6682\u505C\u7684\u957F\u89C6\u9891\u7EE7\u7EED\u751F\u6210\uFF1A\u4F20\u4E0A\u4E00\u6B21\u7ED3\u679C\u91CC\u7684 resumeDir\uFF08\u90A3\u4E2A\u5206\u6BB5\u76EE\u5F55\uFF09\u3002\u63D2\u4EF6\u4F1A\u6CBF\u7528\u6682\u505C\u8BB0\u5F55\u91CC\u7684\u63D0\u793A\u8BCD\u3001\u5206\u6BB5\u8BA1\u5212\u548C\u5DF2\u7ECF\u751F\u6210\u597D\u7684\u524D\u51E0\u6BB5\uFF0C\u53EA\u628A\u5269\u4E0B\u7684\u79D2\u6570\u751F\u6210\u5B8C\u518D\u5408\u5E76\uFF1Bprompt \u53EF\u4EE5\u7701\u7565\uFF08\u8981\u6539\u5267\u60C5\u518D\u4F20\uFF09\uFF0Cduration \u4F20\u66F4\u5927\u7684\u6570\u53EF\u4EE5\u987A\u624B\u628A\u603B\u65F6\u957F\u52A0\u957F\u3002\u540C\u4E00\u4EFD\u6682\u505C\u8FDB\u5EA6\u540C\u65F6\u53EA\u5141\u8BB8\u4E00\u6B21 resume \u5728\u8DD1\uFF1A\u5DF2\u7ECF\u6709\u522B\u7684\u8C03\u7528\u5728\u7EED\u505A\u65F6\u4F1A\u76F4\u63A5\u62A5\u9519\uFF0C\u7B49\u5B83\u8DD1\u5B8C\u518D\u7EE7\u7EED\uFF0C\u522B\u91CD\u590D\u53D1\uFF08\u91CD\u590D\u4F1A\u628A\u5269\u4E0B\u7684\u6BB5\u63D0\u4EA4\u4E24\u904D\u3001\u91CD\u590D\u6263\u8D39\uFF09\u3002"
        },
        merge: {
          type: "boolean",
          description: "\u662F\u5426\u4E0B\u8F7D\u5206\u6BB5\u5E76\u7528 ffmpeg \u5408\u5E76\u6210\u4E00\u4E2A\u672C\u5730\u6210\u7247\uFF0C\u9ED8\u8BA4 true\uFF1B\u672C\u673A\u6CA1\u6709 ffmpeg \u65F6\uFF0C\u957F\u89C6\u9891\u4F1A\u88AB\u5148\u62E6\u56DE\u6765\u8BA9\u7528\u6237\u51B3\u5B9A\u8981\u4E0D\u8981\u88C5\uFF08\u89C1 description\uFF09\uFF1B\u663E\u5F0F\u4F20 false \u8868\u793A\u53EA\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF0C\u4E0D\u518D\u62E6\u3002"
        },
        keepSegments: {
          type: "boolean",
          description: "\u65E7\u53C2\u6570\u517C\u5BB9\uFF1B\u65E0\u8BBA\u53D6\u503C\u5982\u4F55\uFF0C\u539F\u59CB\u5206\u6BB5\u59CB\u7EC8\u4FDD\u7559\u3002"
        }
      },
      required: []
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          mode: { type: "string" },
          plannedSeconds: { type: "integer" },
          totalSeconds: { type: "integer" },
          videoUrl: { type: "string" },
          videoPath: { type: "string" },
          actualSeconds: { type: "number" },
          seamCuts: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, seconds: { type: "number" }, tailSeconds: { type: "number" } } } },
          merged: { type: "boolean" },
          seamTrimSeconds: { type: "string", description: "\u9884\u89C8\u786E\u8BA4\u540E\u88C1\u526A\u5404\u63A5\u7F1D\uFF1A\u5982 0.5,0 \u8868\u793A\u4EC5\u88C1\u7B2C2\u6BB5\u5F00\u59340.5\u79D2\uFF1B\u7559\u7A7A\u65F62.0\u88C1\u524D\u6BB5\u5C3E6\u5E27\u548C\u540E\u6BB5\u59341\u5E27\uFF0C2.5\u4E0D\u88C1\uFF1B\u586B0\u5173\u95ED\u3002\u97F3\u89C6\u9891\u540C\u6B65\u88C1\u526A\uFF0C\u5B9E\u9645\u65F6\u957F\u7F29\u77ED\u3002" },
          mergeMode: { type: "string" },
          segmentsDir: { type: "string" },
          ffmpegMissing: { type: "boolean" },
          installHint: { type: "string" },
          partial: { type: "boolean" },
          paused: { type: "boolean" },
          nextAction: { type: "string" },
          previewPath: { type: "string" },
          resumeDir: { type: "string" },
          remainingSeconds: { type: "integer" },
          pendingTaskId: { type: "string" },
          deliveryError: { type: "string" },
          images: { type: "array" },
          note: { type: "string" },
          error: { type: "string" },
          errorCode: { type: "string" },
          submissionId: { type: "string" },
          convertedReferences: { type: "array", items: { type: "object", properties: { role: { type: "string" }, imageUrl: { type: "string" } } } },
          segments: { type: "array", items: VIDEO_SEGMENT_OUTPUT_SCHEMA }
        }
      },
      render(_args, value) {
        return renderVideoResult(value);
      }
    },
    timeoutMs: 36e5,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const config2 = snapshotConfig(liveConfig);
      const apiKey = resolveApiKey(config2);
      assertConfigured(config2, apiKey);
      const resumeDir = resumeDirOf(args?.resume);
      const resume = resumeDir ? await readPauseFile(resumeDir) : null;
      assertResumeConnection(resume, config2, args);
      if (resume?.toolName && resume.toolName !== TOOL_NAME) throw new Error(`\u8FD9\u4EFD\u8FDB\u5EA6\u8BF7\u4F7F\u7528 ${resume.toolName} \u7EE7\u7EED\u3002`);
      args = { ...resume?.options || {}, ...args };
      args.mode = args.mode || "continuous";
      args.resolution = resolveResolution(config2, args);
      if (args.transitionDescription !== void 0 && typeof args.transitionDescription !== "string") {
        throw new Error("\u8FC7\u6E21\u63CF\u8FF0\u5FC5\u987B\u662F\u6587\u5B57\u3002");
      }
      const prompt = String(args?.prompt ?? "").trim() || String(resume?.prompt ?? "").trim();
      if (!prompt) {
        throw new Error(resumeDir ? "\u8FD9\u6B21\u662F\u63A5\u7740\u4E0A\u4E00\u6B21\u6682\u505C\u7684\u89C6\u9891\u7EE7\u7EED\uFF0C\u4F46\u6682\u505C\u8BB0\u5F55\u91CC\u6CA1\u6709\u63D0\u793A\u8BCD\uFF1A\u8BF7\u628A prompt \u8865\u4E0A\u3002" : "\u63D0\u793A\u8BCD prompt \u4E0D\u80FD\u4E3A\u7A7A\u3002");
      }
      const target = resolveTargetPlan(config2, args);
      const { singleMax, segmentSeconds, cap, asked } = target;
      const restarted = resume ? resumePlanFrom(resume, {
        askedTotal: args?.duration == null ? null : asked,
        segmentSeconds
      }) : null;
      const plan = resume?.deliveryPending ? [] : restarted ? restarted.plan : target.plan;
      const fullPlan = restarted ? restarted.fullPlan : target.plan;
      const total = restarted ? restarted.total : target.total;
      const doneBefore = restarted ? Number(resume.done) || 0 : 0;
      const plannedTotal = plan.reduce((sum, step) => sum + step.seconds, 0);
      const notes = [];
      if (restarted) {
        notes.push(
          `\u63A5\u7740\u4E0A\u4E00\u6B21\u6682\u505C\u7684\u8FDB\u5EA6\u7EE7\u7EED\uFF1A\u524D\u9762 ${doneBefore} \u6BB5\uFF08${restarted.cursor} \u79D2\uFF09\u4E0D\u91CD\u65B0\u751F\u6210\uFF0C\u8FD9\u6B21\u8FD8\u8981\u751F\u6210 ${plan.length} \u6BB5\u5171 ${plannedTotal} \u79D2\u3002`
        );
      } else if (asked > total) {
        notes.push(
          `\u76EE\u6807 ${asked} \u79D2\u8D85\u8FC7\u5355\u6761\u6210\u7247\u4E0A\u9650 ${cap} \u79D2\uFF08\u9996\u6BB5\u6700\u957F ${singleMax} \u79D2 + \u6BCF\u6BB5\u6700\u591A ${segmentSeconds} \u79D2 \xD7 ${MAX_SEGMENTS - 1}\uFF09\uFF0C\u672C\u6B21\u6309 ${total} \u79D2\u6267\u884C\u3002`
        );
      }
      if (!restarted && plannedTotal < total) {
        notes.push(
          `\u76EE\u6807 ${total} \u79D2\u6392\u4E0D\u6EE1\uFF08\u6BCF\u6BB5\u4E0A\u9650 ${segmentSeconds} \u79D2 \xD7 ${MAX_SEGMENTS} \u6BB5\uFF09\uFF0C\u672C\u6B21\u6309 ${plannedTotal} \u79D2\u6267\u884C\u3002`
        );
      } else if (!restarted && plannedTotal > total) {
        notes.push(
          `\u76EE\u6807 ${total} \u79D2\u62C6\u4E0D\u51FA\u5B8C\u5168\u7B49\u957F\u7684\u5206\u6BB5\uFF08\u6BCF\u6BB5 4 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09 \u79D2\uFF09\uFF0C\u672C\u6B21\u6309 ${plannedTotal} \u79D2\u6267\u884C\u3002`
        );
      }
      const segments = [];
      if (restarted) {
        for (const step of resume.steps || []) {
          segments.push({
            index: step.index,
            kind: step.kind,
            seconds: step.seconds,
            taskId: step.taskId,
            status: "succeeded",
            videoUrl: step.videoUrl
          });
        }
      }
      const resultImages = [];
      let submissionId;
      let convertedReferences;
      let status = "succeeded";
      let error;
      let errorCode;
      let referenceUrl = restarted ? String(resume.lastVideoUrl || "") : "";
      let cursor = restarted ? restarted.cursor : 0;
      let paused = false;
      const resumeOptions = restarted ? resume.options || {} : {};
      const suppliedPrompts = resolveSegmentPrompts(
        args?.segmentPrompts ?? resumeOptions.segmentPrompts,
        fullPlan.length
      );
      const outDir = await resolveOutputDir(config2, exec, deps);
      const { stamp, segmentsDir } = resume ? { stamp: String(resume.stamp || fileStamp()), segmentsDir: resumeDir } : await allocateStamp(outDir, fileStamp());
      let pendingTask = resume?.pendingTask || null;
      const operationState = resume?.operationState || {};
      let characterReferences = await initialCharacterReferences(config2, args, resume, exec?.signal);
      const checkpoint = async () => saveProgress(segmentsDir, {
        config: config2,
        toolName: TOOL_NAME,
        stamp,
        prompt,
        fullPlan,
        cursor,
        referenceUrl,
        options: pickResumeOptions(args),
        segments,
        pendingTask,
        operationState,
        characterReferences
      });
      if (resume?.deliveryPending) await checkpoint();
      let interrupted = false;
      try {
        for (const [offset, step] of plan.entries()) {
          if (exec?.signal?.aborted) throw abortError();
          const position = doneBefore + offset;
          const focusedPrompt = suppliedPrompts ? buildSegmentExecutionPrompt({ prompt: suppliedPrompts[position], kind: step.kind, index: position, count: fullPlan.length }) : prompt;
          const stepArgs = {
            ...resumeOptions,
            ...args,
            characterReferences,
            prompt: focusedPrompt,
            duration: step.seconds,
            // 这条流程是「先直出再向后续拍」，分段的拼接顺序固定为向后延长。
            direction: "backward",
            startAt: step.kind === "extend" && isOmniExtendModel(resolveModel(config2)) ? cursor : void 0
          };
          let body;
          let seconds;
          if (operationState[position]?.originalBody) {
            body = operationState[position].originalBody;
            seconds = step.seconds;
          } else if (step.kind === "generate") {
            const initialArgs = { ...stepArgs };
            if (characterReferences.length) {
              if (!stepArgs.firstFrameUrl && (!stepArgs.referenceImages || args.characterReferenceImages === void 0)) initialArgs.referenceImages = characterReferences.map((item) => item.image_url.url);
              else if (stepArgs.firstFrameUrl && args.characterReferenceImages === void 0) initialArgs.firstFrameUrl = characterReferences[0].image_url.url;
            }
            const generated = await buildGenerationBody(config2, initialArgs, step.seconds, {
              signal: exec?.signal
            });
            body = generated.body;
            seconds = generated.seconds;
            if (generated.images?.length) resultImages.push(...generated.images);
            if (generated.notes?.length) notes.push(...generated.notes);
          } else {
            ({ body, seconds } = buildRequestBody(config2, stepArgs, referenceUrl));
          }
          const final = await runTask(config2, body, exec?.signal, {
            ctx,
            exec,
            state: operationState[position] ||= {},
            saveState: checkpoint,
            scope: `${segmentsDir}:${position}`,
            referenceImagesReviewed: args?.referenceImagesReviewed === true,
            taskId: pendingTask?.taskId,
            onCreated: async (taskId) => {
              pendingTask = { taskId, index: position + 1, kind: step.kind, seconds };
              await checkpoint();
            }
          });
          if (final.status === "succeeded") {
            characterReferences = approvedCharacterReferences(characterReferences, operationState[position]);
            await checkpoint();
          }
          if (final.submissionId) submissionId = final.submissionId;
          if (final.convertedReferences) convertedReferences = final.convertedReferences;
          pendingTask = ["unknown", "timeout"].includes(final.status) ? { taskId: final.taskId, index: position + 1, kind: step.kind, seconds } : null;
          const detail = final.errorCode === "content_rejected" ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${final.error || ""}` : final.error;
          segments.push({
            index: position + 1,
            kind: step.kind,
            seconds,
            taskId: final.taskId,
            status: final.status,
            videoUrl: final.videoUrl,
            error: detail
          });
          if (final.status !== "succeeded" || !final.videoUrl) {
            await checkpoint();
            status = final.status;
            errorCode = final.errorCode;
            error = detail;
            break;
          }
          referenceUrl = normalizeReferenceUrl(final.videoUrl);
          cursor += seconds;
          await checkpoint();
          if (plan[offset + 1]) {
            paused = true;
            notes.push("\u672C\u6BB5\u5DF2\u5B8C\u6210\uFF1A\u8BF7\u5148\u5C55\u793A\u672C\u6B21\u89C6\u9891\u6210\u679C\uFF0C\u8BA9\u7528\u6237\u9884\u89C8\uFF1B\u7528\u6237\u786E\u8BA4\u7EE7\u7EED\u540E\u518D\u7528 resume \u63A5\u7740\u751F\u6210\u4E0B\u4E00\u6BB5\u3002");
            break;
          }
        }
      } catch (failure) {
        const doneYet = segments.some((segment) => segment.status === "succeeded" && segment.videoUrl);
        if (failure?.code !== "ABORTED" || !doneYet) throw failure;
        interrupted = true;
        paused = true;
        notes.push(
          "\u8FD9\u6B21\u8C03\u7528\u88AB\u4E2D\u65AD\u4E86\uFF08\u7528\u6237\u70B9\u4E86\u505C\u6B62\uFF0C\u6216\u8005\u7B49\u8D85\u65F6\u4E86\uFF09\uFF1A\u5DF2\u7ECF\u751F\u6210\u597D\u7684\u90E8\u5206\u4F1A\u5148\u4E0B\u8F7D\u3001\u5408\u5E76\u3001\u4EA4\u4ED8\uFF0C\u5269\u4E0B\u7684\u79D2\u6570\u4E0D\u7528\u91CD\u5934\u518D\u6765\u2014\u2014\u7528 resume \u5C31\u80FD\u63A5\u7740\u505A\u3002"
        );
      }
      const completed = segments.filter((segment) => segment.status === "succeeded" && segment.videoUrl);
      const result = {
        status,
        mode: fullPlan.length > 1 ? "extended" : "direct",
        plannedSeconds: restarted ? total : plannedTotal,
        totalSeconds: completed.reduce((sum, segment) => sum + segment.seconds, 0),
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        error,
        errorCode,
        submissionId,
        convertedReferences,
        ...convertedReferences ? { nextAction: "present_reference_images_then_wait_for_user" } : {}
      };
      if (resume?.deliveryPending && doneBefore < fullPlan.length) paused = true;
      if (paused) {
        result.paused = true;
        result.remainingSeconds = Math.max(0, fullPlan.reduce((sum, step) => sum + step.seconds, 0) - completed.reduce((sum, step) => sum + step.seconds, 0));
      }
      result.resumeDir = segmentsDir;
      result.segmentsDir = segmentsDir;
      if (pendingTask) {
        result.pendingTaskId = pendingTask.taskId;
        result.note = "\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u7528 resume \u67E5\u8BE2\u5E76\u63A5\u56DE\u539F\u8FDB\u5EA6\uFF0C\u6216\u7528 video_status \u67E5\u8BE2\uFF1B\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u3002";
      }
      if (resultImages.length) {
        result.images = resultImages.map((item) => ({
          role: item.role,
          source: item.source,
          localPath: item.localPath,
          bytes: item.bytes,
          originalPath: item.originalPath,
          fittedTo: item.fittedTo,
          uploadedAt: item.uploadedAt,
          recentUploads: item.recentUploads
        }));
      }
      const deliveredSeconds = completed.reduce((sum, segment) => sum + segment.seconds, 0);
      if (status !== "succeeded") {
        const last = segments.at(-1) || {};
        if (status === "unknown" || status === "timeout") {
          result.pendingTaskId = last.taskId;
          notes.push(
            `\u7B2C ${last.index ?? segments.length} \u6BB5\u7684\u67E5\u8BE2\u6CA1\u62FF\u5230\u7ED3\u679C\uFF08${status}\uFF09\uFF0C\u4F46\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF1A${last.taskId || "\uFF08\u65E0\u4EFB\u52A1 ID\uFF09"}\u3002\u5B83\u53EF\u80FD\u4ECD\u5728\u751F\u6210\u2014\u2014\u7528 video_status \u6309\u8FD9\u4E2A ID \u590D\u67E5\uFF0C\u62FF\u5230\u94FE\u63A5\u5C31\u80FD\u8865\u4E0A\u8FD9\u4E00\u6BB5\uFF0C\u4E0D\u7528\u91CD\u65B0\u63D0\u4EA4\u3001\u4E0D\u4F1A\u91CD\u590D\u6263\u8D39\u3002`
          );
        } else {
          notes.push(`\u7B2C ${last.index ?? segments.length} \u6BB5\u6CA1\u6709\u6210\u529F\uFF08${status}\uFF09\u3002`);
        }
        if (completed.length) {
          notes.push(
            `\u5DF2\u628A\u6210\u529F\u7684 ${completed.length} \u6BB5\uFF08${deliveredSeconds} \u79D2\uFF09\u4E0B\u8F7D\u5E76\u5408\u5E76\u4EA4\u4ED8\uFF0C\u53EF\u4F5C\u4E3A\u6B8B\u7247\u4F7F\u7528\u3002`
          );
          result.partial = true;
        } else {
          result.note = notes.join("\n");
          return result;
        }
      }
      if (args?.merge === false) {
        if (paused) {
          result.paused = true;
          result.nextAction = "present_video_then_wait_for_user";
          result.remainingSeconds = Math.max(0, total - deliveredSeconds);
          notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        }
        result.note = [...notes, "\u6309\u53C2\u6570\u8981\u6C42\u53EA\u8FD4\u56DE\u4E0A\u6E38\u94FE\u63A5\uFF0C\u6CA1\u6709\u4E0B\u8F7D\u5408\u5E76\u3002"].join("\n");
        return result;
      }
      const delivery = await downloadSegmentsAndMerge(config2, {
        segments: completed,
        segmentsDir,
        outDir,
        stamp,
        notes,
        // 暂停时只有一段的话，这一段的文件要留在分段目录里给之后续做用。
        keepSingleFile: paused,
        // 被中断时请求信号已经 abort：收尾（下载 + 合并）不能被它打断，否则等于白生成。
        signal: interrupted || exec?.signal?.aborted ? void 0 : exec?.signal
      });
      if (delivery.error) {
        result.deliveryError = delivery.error;
        if (delivery.ffmpegMissing) {
          result.ffmpegMissing = true;
          result.installHint = delivery.installHint;
        }
        result.nextAction = "resume_delivery_without_regeneration";
        result.segmentsDir = delivery.segmentsDir;
        result.note = [...notes, delivery.error].join("\n");
        return result;
      }
      if (delivery.ffmpegMissing) {
        result.segmentsDir = delivery.segmentsDir;
        result.merged = false;
        result.ffmpegMissing = true;
        result.installHint = delivery.installHint;
        result.note = notes.join("\n");
        return result;
      }
      if (!delivery.files.length) return result;
      if (delivery.merged) {
        result.merged = true;
        result.videoPath = delivery.videoPath;
        result.mergeMode = delivery.mergeMode;
        if (delivery.actualSeconds) result.actualSeconds = delivery.actualSeconds;
        if (delivery.seamCuts?.length) result.seamCuts = delivery.seamCuts;
      }
      if (paused) {
        result.segmentsDir = segmentsDir;
        result.resumeDir = segmentsDir;
        result.paused = true;
        result.nextAction = "present_video_then_wait_for_user";
        result.previewPath = completed.at(-1)?.localPath || result.videoPath;
        await appendRequestLog({ event: "preview_required", previewPath: result.previewPath, resumeDir: result.resumeDir });
        result.remainingSeconds = Math.max(0, total - deliveredSeconds);
        notes.push(`\u5DF2\u4EA4\u4ED8\u7684\u6210\u7247\u662F\u4ECE\u5934\u5230\u7B2C ${segments.length} \u6BB5\uFF0C\u5206\u6BB5\u4ECD\u4FDD\u7559\u5728 ${segmentsDir}\u3002`);
        notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        result.note = notes.join("\n");
        return result;
      }
      result.segmentsDir = segmentsDir;
      if (notes.length) result.note = notes.join("\n");
      return result;
    }
  };
}

// src/tools/video-extend.ts
init_connection();
init_config();
function extendTool(liveConfig, deps, ctx) {
  const config = liveConfig;
  const TOOL_NAME = "video_extend";
  return {
    name: "video_extend",
    description: "\u628A\u4E00\u6BB5\u5DF2\u6709\u7684\u89C6\u9891\u5411\u524D\u6216\u5411\u540E\u5EF6\u957F\uFF1A\u4EE5\u516C\u7F51\u89C6\u9891 URL \u4F5C\u4E3A\u8F93\u5165\u7D20\u6750\uFF0C\u8C03\u7528 Seedance \u751F\u6210\u8854\u63A5\u7247\u6BB5\uFF0C\u4FDD\u6301\u4EBA\u7269\u3001\u670D\u88C5\u3001\u573A\u666F\u5149\u7EBF\u548C\u58F0\u97F3\u8FDE\u7EED\uFF1B\u53EF\u4E00\u6B21\u8FDE\u7EED\u5EF6\u957F\u591A\u6BB5\uFF0C\u6BCF\u6BB5\u90FD\u7528\u4E0A\u4E00\u6BB5\u7684\u7ED3\u679C\u7EE7\u7EED\u5EF6\u957F\u3002\u63D0\u793A\u8BCD\u89C4\u5219\uFF1A\u4EE5\u300C\u5411\u540E\u5EF6\u957F\u89C6\u98911\u300D\u6216\u300C\u5411\u524D\u5EF6\u957F\u89C6\u98911\u300D\u5F00\u5934\uFF08\u4E5F\u53EF\u5199\u300C\u751F\u6210\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF1A\u300D\uFF09\uFF0C\u5168\u7A0B\u7528\u300C\u89C6\u98911\u300D\u6307\u4EE3\u8F93\u5165\u7D20\u6750\uFF0C\u4E0D\u8981\u5199\u6210\u300C\u53C2\u8003\u89C6\u98911\u300D\uFF08\u4F1A\u88AB\u5F53\u6210\u53C2\u8003\u751F\u89C6\u9891\uFF0C\u4E0D\u662F\u5EF6\u957F\uFF09\uFF1B\u5185\u5BB9\u5199\u6E05\u5EF6\u957F\u65B9\u5411\u3001\u5267\u60C5\u53D1\u5C55\u3001\u4E3B\u4F53\u72B6\u6001\u3001\u955C\u5934\u8FD0\u52A8\u548C\u58F0\u97F3\u5EF6\u7EED\uFF08\u80CC\u666F\u97F3\u4E50\u8981\u63A5\u7740\u89C6\u98911\u7ED3\u5C3E\u5F80\u4E0B\u8D70\uFF0C\u7981\u6B62\u4ECE\u5934\u64AD\u653E/\u6362\u66F2\uFF09\uFF0C\u51CF\u5C11\u63A5\u7F1D\u3002\u6BCF\u6BB5 4 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09 \u79D2\uFF0C\u9ED8\u8BA4\u6309\u6240\u9009\u6A21\u578B\u4E0A\u9650\u62C6\u3001\u6BB5\u6570\u6700\u5C11\uFF1B\u4E0A\u6E38\u5BF9\u5361\u6EE1 15 \u79D2\u654F\u611F\u65F6\u518D\u8C03\u5C0F\u3002\u8FD4\u56DE\u6BCF\u6BB5\u7684\u4EFB\u52A1 ID \u548C\u6700\u7EC8\u89C6\u9891\u4E0B\u8F7D\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1B\u751F\u6210\u901A\u5E38\u9700\u8981\u51E0\u5206\u949F\uFF0C\u5355\u6B21\u8C03\u7528\u8FD4\u56DE timeout\u3001\u6216\u67D0\u6BB5\u8FD4\u56DE unknown\uFF08\u67E5\u8BE2\u5931\u8D25\u3001\u4EFB\u52A1\u5176\u5B9E\u5DF2\u63D0\u4EA4\uFF09\u65F6\uFF0C\u90FD\u7528\u8FD4\u56DE\u7684\u4EFB\u52A1 ID \u8D70 video_status \u7EE7\u7EED\u7B49\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u540C\u4E00\u6BB5\u3002\u6BCF\u6BB5\u5EF6\u957F\u5B8C\u5148\u8FD4\u56DE\u6210\u679C\u4F9B\u5C55\u793A\uFF0C\u7528\u6237\u9884\u89C8\u5E76\u786E\u8BA4\u7EE7\u7EED\u540E\u518D\u7528resume\u7EED\u505A\uFF1B\u672A\u786E\u8BA4\u65F6\u505C\u5728\u5F53\u524D\u6210\u679C\uFF0C\u7ED3\u679C\u91CC\u5E26 paused=true\u3001resumeDir\u3001remainingSeconds\uFF1B\u4E4B\u540E\u7528\u6237\u8BF4\u300C\u7EE7\u7EED\u300D\u65F6\u628A resumeDir \u539F\u6837\u4F20\u7ED9 video_extend \u7684 resume \u53C2\u6570\u63A5\u7740\u505A\uFF08\u524D\u9762\u51E0\u6BB5\u4E0D\u91CD\u65B0\u751F\u6210\u3001\u4E0D\u91CD\u590D\u6263\u8D39\uFF09\u3002\u591A\u6BB5\u9ED8\u8BA4\u4F1A\u4E0B\u8F7D\u5206\u6BB5\u5E76\u5728\u672C\u673A\u5408\u5E76\u6210\u4E00\u6761\u6210\u7247\uFF08\u9700\u8981 ffmpeg\uFF09\uFF1A\u6CA1\u6709 ffmpeg \u65F6\u4F1A\u5148\u62E6\u4E0B\u6765\u95EE\u7528\u6237\uFF0C\u7ED3\u679C\u91CC\u4E5F\u4F1A\u5E26 ffmpegMissing \u4E0E\u5B89\u88C5\u5F15\u5BFC\u3002\u4E2D\u9014\u88AB\u505C\u6B62 / \u7B49\u8D85\u65F6\u540C\u7406\uFF1A\u5DF2\u7ECF\u5EF6\u957F\u597D\u7684\u6BB5\u5148\u4EA4\u4ED8\uFF0C\u5269\u4E0B\u7684\u7528 resume \u63A5\u7740\u505A\u3002",
    parameters: {
      type: "object",
      properties: {
        characterReferenceImages: { type: "array", items: { type: "string" }, description: "\u5DF2\u5BA1\u6838\u7684\u6700\u521D\u89D2\u8272\u53C2\u8003\u56FE\uFF0C\u6309\u56FA\u5B9A\u987A\u5E8F\u7528\u4E8E\u6BCF\u6BB5\u7EED\u62CD\uFF1B\u672A\u63D0\u4F9B\u65F6\u6CBF\u7528\u9996\u6BB5\u53C2\u8003\u56FE\u6216\u9996\u5E27\u3002\u652F\u6301URL\u3001\u672C\u5730\u56FE\u7247\u6216data URI\u3002\u65AD\u70B9\u56FA\u5B9A\u6B64\u5957\u56FE\uFF0C\u4E0D\u81EA\u52A8\u91CD\u753B\u6216\u66FF\u6362\u3002\u771F\u4EBA\u8F6C\u6362\u4ECD\u9700\u5355\u72EC\u540C\u610F\u53CA\u7ED3\u679C\u5BA1\u6838\u3002" },
        prompt: {
          type: "string",
          description: "\u672C\u6BB5\u8981\u7EED\u62CD\u7684\u5267\u60C5\u5185\u5BB9\u4E0E\u4EBA\u7269\u8BBE\u5B9A\uFF1B\u4E0D\u8981\u5728\u63D0\u793A\u8BCD\u91CC\u91CD\u590D\u5DF2\u53D1\u751F\u7684\u60C5\u8282\u3002"
        },
        inputVideoSeconds: { type: "number", minimum: 1e-3, description: "\u5DF2\u6709\u8F93\u5165\u89C6\u9891\u7684\u771F\u5B9E\u65F6\u957F\uFF08\u79D2\uFF09\uFF0C\u7528\u4E8E\u8D39\u7528\u9884\u4F30\uFF1B\u987B\u6838\u5B9E\u7D20\u6750\uFF0C\u4E0D\u731C\u6D4B\u3002\u7EED\u505A\u81EA\u52A8\u8BFB\u53D6\u4E0A\u4E00\u6BB5\u65F6\u957F\u3002" },
        videoUrl: {
          type: "string",
          description: "\u53C2\u8003\u89C6\u9891\u7684\u516C\u7F51 URL\uFF08https:// \u6216 http://\uFF09\u3002\u4E0E taskId \u4E8C\u9009\u4E00\u3002"
        },
        taskId: {
          type: "string",
          description: "\u5DF2\u6709\u7684 video_generate / video_extend \u4EFB\u52A1 ID\uFF0C\u7528\u5B83\u7684\u6210\u7247\u4F5C\u4E3A\u8F93\u5165\u7D20\u6750\u3002\u4E0E videoUrl \u4E8C\u9009\u4E00\u3002"
        },
        duration: {
          type: "integer",
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description: "\u6BCF\u6BB5\u65B0\u589E\u7684\u79D2\u6570\u4E0A\u9650\uFF0C4 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09 \u7684\u6574\u6570\uFF08\u5982 5/8/10/14\uFF0C\u9ED8\u8BA4\u6309\u6A21\u578B\u4E0A\u9650\uFF09\uFF1B\u521A\u597D\u5361 15 \u79D2\u5BB9\u6613\u56E0\u5C01\u88C5\u7565\u8D85\u88AB\u4E0A\u6E38\u62D2\u7EDD\u3002\u7701\u7565\u65F6\u4F7F\u7528\u914D\u7F6E\u9ED8\u8BA4\u503C\u3002"
        },
        direction: {
          type: "string",
          enum: ["backward", "forward"],
          description: "backward=\u5411\u540E\u5EF6\u957F\uFF0C\u7EED\u62CD\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF08\u9ED8\u8BA4\uFF09\uFF1Bforward=\u5411\u524D\u5EF6\u957F\uFF0C\u751F\u6210\u89C6\u98911\u4E4B\u524D\u7684\u524D\u7F6E\u5267\u60C5\u3002"
        },
        wording: {
          type: "string",
          enum: ["extend", "after"],
          description: "\u63D0\u793A\u8BCD\u5F00\u5934\u5199\u6CD5\uFF1Aextend=\u300C\u5411\u540E\u5EF6\u957F\u89C6\u98911\u300D/\u300C\u5411\u524D\u5EF6\u957F\u89C6\u98911\u300D\uFF08\u9ED8\u8BA4\uFF09\uFF1Bafter=\u300C\u751F\u6210\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF1A\u300D\uFF08\u4EC5\u5411\u540E\u5EF6\u957F\uFF09\u3002"
        },
        segments: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "\u8FDE\u7EED\u5EF6\u957F\u51E0\u6BB5\uFF0C\u9ED8\u8BA4 1\uFF1B\u6BCF\u6BB5\u90FD\u5F15\u7528\u4E0A\u4E00\u6BB5\u7684\u7ED3\u679C\uFF0C\u9002\u5408\u505A\u51FA\u66F4\u957F\u7684\u6210\u7247\u3002"
        },
        transitionDescription: {
          type: "string",
          description: "\u5DF2\u5BA1\u6838\u7684\u7EED\u62CD\u8FC7\u6E21\u63CF\u8FF0\uFF1A\u89C6\u98911\u63A5\u7F1D\u72B6\u6001\u2192\u672C\u6BB5\u52A8\u4F5C/\u955C\u5934\u8854\u63A5\u2192\u58F0\u97F3\u5EF6\u7EED\uFF0C\u76F4\u63A5\u4F7F\u7528\u201C\u89C6\u98911\u201D\uFF0C\u4E0D\u5199\u201C\u53C2\u8003\u89C6\u98911\u201D\u3002\u591A\u6BB5\u5171\u7528\u65F6\u4F5C\u4E3A\u901A\u7528\u63CF\u8FF0\uFF1Bvideo_generate \u53EF\u5728\u5404\u6761 segmentPrompts \u5185\u7528\u5355\u884C\u3010\u8FC7\u6E21\u753B\u9762\u3011\u6307\u5B9A\u8BE5\u6BB5\u8FC7\u6E21\u5E76\u4F18\u5148\u91C7\u7528\u3002\u4EC5\u4F5C\u7528\u4E8E\u7EED\u62CD\uFF0C\u9996\u6B21\u76F4\u51FA\u4E0D\u5F15\u7528\u89C6\u98911\u3002"
        },
        mode: {
          type: "string",
          enum: ["continuous", "closeup"],
          description: "\u7531\u5DF2\u5BA1\u6838\u811A\u672C\u51B3\u5B9A\u672C\u6B21\u7EED\u62CD\uFF1Acontinuous=\u540C\u673A\u4F4D\u8FDE\u7EED\uFF08\u672A\u6307\u5B9A\u65F6\uFF09\uFF1Bcloseup=\u6309\u811A\u672C\u5207\u6362\u8FD1\u666F\u6216\u53CD\u5E94\u955C\u5934\uFF0C\u5177\u4F53\u5B89\u6392\u4EE5\u8FC7\u6E21\u63CF\u8FF0\u4E3A\u51C6\u3002"
        },
        startAt: {
          type: "number",
          minimum: 0,
          description: "\u89C6\u98911\u5DF2\u6709\u7684\u79D2\u6570\uFF1B\u7ED9\u4E86\u5C31\u6309\u300C\u6574\u7247\u7B2C X\u2013Y \u79D2\u300D\u63CF\u8FF0\u672C\u6BB5\u3002\u5411\u540E\u5EF6\u957F\u65F6\u9010\u6BB5\u7D2F\u52A0\uFF0C\u5411\u524D\u5EF6\u957F\u65F6\u9010\u6BB5\u524D\u79FB\u3002"
        },
        ratio: {
          type: "string",
          enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
          description: "\u753B\u9762\u6BD4\u4F8B\uFF1Bseedance 2.5 \u5EF6\u957F\u65F6\u4F1A\u81EA\u52A8\u6539\u7528 adaptive\u3002"
        },
        generateAudio: {
          type: "boolean",
          description: "\u662F\u5426\u751F\u6210\u97F3\u9891\uFF0C\u9ED8\u8BA4 true\u3002"
        },
        watermark: {
          type: "boolean",
          description: "\u662F\u5426\u6DFB\u52A0\u6C34\u5370\uFF0C\u9ED8\u8BA4 false\u3002"
        },
        merge: { type: "boolean", description: "\u9ED8\u8BA4true\uFF1A\u4E0B\u8F7D\u5206\u6BB5\u5E76\u5728\u672C\u673A\u5408\u5E76\uFF1Bfalse\u53EA\u8FD4\u56DE\u4E0A\u6E38\u94FE\u63A5\u3002\u7EED\u505A\u9ED8\u8BA4\u6CBF\u7528\u539F\u8BBE\u7F6E\u3002" },
        resolution: { type: "string", enum: ["480p", "720p"], description: "\u89C6\u9891\u6E05\u6670\u5EA6\uFF0C\u53EF\u9009 480P \u6216 720P\uFF1B\u6309\u7528\u6237\u786E\u8BA4\u7684\u811A\u672C\u663E\u5F0F\u4F20\u5165\uFF0C\u7EED\u505A\u672A\u6307\u5B9A\u65F6\u6CBF\u7528\u539F\u6E05\u6670\u5EA6\u3002" },
        referenceImagesReviewed: { type: "boolean", description: "\u4EC5\u5F53\u4E0A\u4E00\u8F6E\u8FD4\u56DE review_required\uFF0C\u5DF2\u5B9E\u9645\u5C55\u793A\u6240\u6709\u8F6C\u6362\u56FE\u7247\u4E14\u7528\u6237\u660E\u786E\u786E\u8BA4\u975E\u771F\u4EBA\u6548\u679C\u5E76\u540C\u610F\u89C6\u9891\u91CD\u8BD5\u540E\u4F20 true\uFF1B\u9996\u6B21\u8C03\u7528\u4E0D\u5F97\u9884\u5148\u8BBE\u7F6E\u3002" },
        resumeWithCurrentConfig: { type: "boolean", description: "\u4EC5\u5728\u7528\u6237\u660E\u786E\u786E\u8BA4\u66F4\u6362\u539F\u8FDB\u5EA6\u7684\u6A21\u578B\u6216\u63A5\u5165\u6E20\u9053\u540E\u8BBE\u4E3Atrue\uFF1B\u6709\u5F85\u67E5\u8BE2\u4EFB\u52A1\u65F6\u5FC5\u987B\u6062\u590D\u539F\u6E20\u9053\u3002" },
        resume: {
          type: "string",
          description: "\u63A5\u7740\u4E0A\u4E00\u6B21\u6682\u505C\u7684\u5EF6\u957F\u7EE7\u7EED\uFF1A\u4F20\u4E0A\u4E00\u6B21\u7ED3\u679C\u91CC\u7684 resumeDir\u3002\u63D2\u4EF6\u4F1A\u6CBF\u7528\u6682\u505C\u8BB0\u5F55\u91CC\u7684\u63D0\u793A\u8BCD\u3001\u5EF6\u957F\u65B9\u5411\u548C\u5269\u4E0B\u7684\u6BB5\u6570\uFF0C\u53EA\u628A\u6CA1\u505A\u7684\u90E8\u5206\u751F\u6210\u5B8C\u518D\u5408\u5E76\uFF1Bprompt / videoUrl / direction \u90FD\u53EF\u4EE5\u7701\u7565\u3002\u60F3\u987A\u624B\u591A\u5EF6\u957F\u51E0\u6BB5\u5C31\u518D\u4F20 segments\uFF08\u8868\u793A\u5728\u5269\u4E0B\u7684\u57FA\u7840\u4E0A\u300C\u518D\u52A0\u300D\u51E0\u6BB5\uFF09\u3002\u540C\u4E00\u4EFD\u6682\u505C\u8FDB\u5EA6\u540C\u65F6\u53EA\u5141\u8BB8\u4E00\u6B21 resume \u5728\u8DD1\uFF1A\u5DF2\u7ECF\u6709\u522B\u7684\u8C03\u7528\u5728\u7EED\u505A\u65F6\u4F1A\u76F4\u63A5\u62A5\u9519\uFF0C\u7B49\u5B83\u8DD1\u5B8C\u518D\u7EE7\u7EED\uFF0C\u522B\u91CD\u590D\u53D1\uFF08\u91CD\u590D\u4F1A\u628A\u5269\u4E0B\u7684\u6BB5\u63D0\u4EA4\u4E24\u904D\u3001\u91CD\u590D\u6263\u8D39\uFF09\u3002"
        }
      },
      required: []
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          videoUrl: { type: "string" },
          videoPath: { type: "string" },
          actualSeconds: { type: "number" },
          seamCuts: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, seconds: { type: "number" }, tailSeconds: { type: "number" } } } },
          merged: { type: "boolean" },
          seamTrimSeconds: { type: "string", description: "\u9884\u89C8\u786E\u8BA4\u540E\u88C1\u526A\u5404\u63A5\u7F1D\uFF1A\u5982 0.5,0 \u8868\u793A\u4EC5\u88C1\u7B2C2\u6BB5\u5F00\u59340.5\u79D2\uFF1B\u7559\u7A7A\u65F62.0\u88C1\u524D\u6BB5\u5C3E6\u5E27\u548C\u540E\u6BB5\u59341\u5E27\uFF0C2.5\u4E0D\u88C1\uFF1B\u586B0\u5173\u95ED\u3002\u97F3\u89C6\u9891\u540C\u6B65\u88C1\u526A\uFF0C\u5B9E\u9645\u65F6\u957F\u7F29\u77ED\u3002" },
          mergeMode: { type: "string" },
          segmentsDir: { type: "string" },
          ffmpegMissing: { type: "boolean" },
          installHint: { type: "string" },
          partial: { type: "boolean" },
          paused: { type: "boolean" },
          nextAction: { type: "string" },
          previewPath: { type: "string" },
          resumeDir: { type: "string" },
          remainingSeconds: { type: "integer" },
          totalSeconds: { type: "integer" },
          pendingTaskId: { type: "string" },
          deliveryError: { type: "string" },
          error: { type: "string" },
          errorCode: { type: "string" },
          note: { type: "string" },
          submissionId: { type: "string" },
          convertedReferences: { type: "array", items: { type: "object", properties: { role: { type: "string" }, imageUrl: { type: "string" } } } },
          segments: { type: "array", items: SEGMENT_OUTPUT_SCHEMA }
        }
      },
      render(_args, value) {
        return renderResult(value);
      }
    },
    timeoutMs: 18e5,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const config2 = snapshotConfig(liveConfig);
      const apiKey = resolveApiKey(config2);
      assertConfigured(config2, apiKey);
      const resumeDir = resumeDirOf(args?.resume);
      const resume = resumeDir ? await readPauseFile(resumeDir) : null;
      assertResumeConnection(resume, config2, args);
      if (resume?.toolName && resume.toolName !== TOOL_NAME) throw new Error(`\u8FD9\u4EFD\u8FDB\u5EA6\u8BF7\u4F7F\u7528 ${resume.toolName} \u7EE7\u7EED\u3002`);
      args = { ...resume?.options || {}, ...args };
      args.mode = args.mode || "continuous";
      args.resolution = resolveResolution(config2, args);
      if (args.transitionDescription !== void 0 && typeof args.transitionDescription !== "string") {
        throw new Error("\u8FC7\u6E21\u63CF\u8FF0\u5FC5\u987B\u662F\u6587\u5B57\u3002");
      }
      const prompt = String(args?.prompt ?? "").trim() || String(resume?.prompt ?? "").trim();
      if (!prompt) {
        throw new Error(resumeDir ? "\u8FD9\u6B21\u662F\u63A5\u7740\u4E0A\u4E00\u6B21\u6682\u505C\u7684\u5EF6\u957F\u7EE7\u7EED\uFF0C\u4F46\u6682\u505C\u8BB0\u5F55\u91CC\u6CA1\u6709\u63D0\u793A\u8BCD\uFF1A\u8BF7\u628A prompt \u8865\u4E0A\u3002" : "\u63D0\u793A\u8BCD prompt \u4E0D\u80FD\u4E3A\u7A7A\u3002");
      }
      const lastOptions = resume ? resume.options || {} : {};
      const direction = (args?.direction ?? lastOptions.direction) === "forward" ? "forward" : "backward";
      const wording = (args?.wording ?? lastOptions.wording) === "after" ? "after" : "extend";
      const requestedSegments = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
      const secondsPerSegment = clampInteger(
        args?.duration ?? modelMaxSeconds(config2),
        MIN_SECONDS,
        modelMaxSeconds(config2),
        modelMaxSeconds(config2)
      );
      let referenceUrl = String(args?.videoUrl ?? "").trim();
      if (!referenceUrl && args?.taskId) {
        const sourceId = String(args.taskId).trim();
        let source;
        try {
          source = await getTask(config2, sourceId, exec?.signal);
        } catch (failure) {
          if (failure?.code === "ABORTED") throw failure;
          throw new Error(
            `\u8BFB\u53D6\u53C2\u8003\u89C6\u9891\u4EFB\u52A1 ${sourceId} \u5931\u8D25\uFF1A${failure?.message || failure}\u3002\u8FD9\u4E0D\u4EE3\u8868\u8BE5\u4EFB\u52A1\u6CA1\u6709\u751F\u6210\u2014\u2014\u7A0D\u540E\u91CD\u8BD5\uFF0C\u6216\u76F4\u63A5\u628A\u6210\u7247\u7684\u516C\u7F51\u94FE\u63A5\u7528 videoUrl \u4F20\u8FDB\u6765\u3002`
          );
        }
        referenceUrl = extractVideoUrl(source) || "";
        if (!referenceUrl) {
          throw new Error(
            `\u4EFB\u52A1 ${args.taskId} \u6CA1\u6709\u53EF\u7528\u7684\u89C6\u9891\u94FE\u63A5\uFF08\u72B6\u6001\uFF1A${extractStatus(source) || "\u672A\u77E5"}\uFF09\u3002`
          );
        }
      }
      if (!referenceUrl && resume) referenceUrl = String(resume.lastVideoUrl ?? "").trim();
      referenceUrl = normalizeReferenceUrl(referenceUrl);
      const doneBefore = resume ? Number(resume.done) || 0 : 0;
      const fullPlan = resume ? (resume.plan || []).map((step) => ({ ...step })) : [];
      if (!resume) {
        for (let index = 0; index < requestedSegments; index += 1) {
          fullPlan.push({ kind: "extend", seconds: secondsPerSegment });
        }
      } else if (args?.segments != null) {
        for (let index = 0; index < requestedSegments && fullPlan.length < MAX_SEGMENTS; index += 1) {
          fullPlan.push({ kind: "extend", seconds: secondsPerSegment });
        }
      }
      const plan = resume?.deliveryPending ? [] : fullPlan.slice(doneBefore);
      const plannedSeconds = plan.reduce((sum, step) => sum + step.seconds, 0);
      let cursor = resume ? resume.cursor ?? null : args?.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt)));
      const notes = [];
      const segments = [];
      if (resume) {
        for (const step of resume.steps || []) {
          segments.push({
            index: step.index,
            kind: "extend",
            seconds: step.seconds,
            taskId: step.taskId,
            status: "succeeded",
            videoUrl: step.videoUrl
          });
        }
      }
      let submissionId;
      let convertedReferences;
      let status = "succeeded";
      let error;
      let errorCode;
      let paused = false;
      const outDir = await resolveOutputDir(config2, exec, deps);
      const { stamp, segmentsDir } = resume ? { stamp: String(resume.stamp || fileStamp()), segmentsDir: resumeDir } : await allocateStamp(outDir, fileStamp());
      let pendingTask = resume?.pendingTask || null;
      const operationState = resume?.operationState || {};
      let characterReferences = await initialCharacterReferences(config2, args, resume, exec?.signal);
      const checkpoint = async () => saveProgress(segmentsDir, {
        config: config2,
        toolName: TOOL_NAME,
        stamp,
        prompt,
        fullPlan,
        cursor,
        referenceUrl,
        options: { ...pickResumeOptions(args), direction, wording, startAt: cursor },
        segments,
        pendingTask,
        operationState,
        characterReferences
      });
      if (resume?.deliveryPending) await checkpoint();
      let interrupted = false;
      try {
        for (const [offset, step] of plan.entries()) {
          if (exec?.signal?.aborted) throw abortError();
          const position = doneBefore + offset;
          const { body, seconds } = buildRequestBody(
            config2,
            {
              ...lastOptions,
              ...args,
              characterReferences,
              prompt,
              duration: step.seconds,
              startAt: cursor,
              direction,
              wording
            },
            referenceUrl
          );
          const final = await runTask(config2, body, exec?.signal, {
            ctx,
            exec,
            state: operationState[position] ||= {},
            saveState: checkpoint,
            scope: `${segmentsDir}:${position}`,
            referenceImagesReviewed: args?.referenceImagesReviewed === true,
            taskId: pendingTask?.taskId,
            onCreated: async (taskId2) => {
              pendingTask = { taskId: taskId2, index: position + 1, kind: step.kind, seconds };
              await checkpoint();
            }
          });
          if (final.status === "succeeded") {
            characterReferences = approvedCharacterReferences(characterReferences, operationState[position]);
            await checkpoint();
          }
          if (final.submissionId) submissionId = final.submissionId;
          if (final.convertedReferences) convertedReferences = final.convertedReferences;
          pendingTask = ["unknown", "timeout"].includes(final.status) ? { taskId: final.taskId, index: position + 1, kind: step.kind, seconds } : null;
          const taskId = final.taskId;
          segments.push({
            index: position + 1,
            kind: "extend",
            seconds,
            taskId,
            status: final.status,
            videoUrl: final.videoUrl,
            error: final.errorCode === "content_rejected" ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${final.error || ""}` : final.error
          });
          if (final.status !== "succeeded" || !final.videoUrl) {
            await checkpoint();
            status = final.status;
            errorCode = final.errorCode;
            error = final.errorCode === "content_rejected" ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${final.error || ""}` : final.error;
            break;
          }
          referenceUrl = normalizeReferenceUrl(final.videoUrl);
          if (cursor != null) {
            cursor = direction === "forward" ? cursor - seconds : cursor + seconds;
            if (cursor < 0) cursor = null;
          }
          await checkpoint();
          if (plan[offset + 1]) {
            paused = true;
            notes.push("\u672C\u6BB5\u5DF2\u5B8C\u6210\uFF1A\u8BF7\u5148\u5C55\u793A\u672C\u6B21\u89C6\u9891\u6210\u679C\uFF0C\u8BA9\u7528\u6237\u9884\u89C8\uFF1B\u7528\u6237\u786E\u8BA4\u7EE7\u7EED\u540E\u518D\u7528 resume \u63A5\u7740\u751F\u6210\u4E0B\u4E00\u6BB5\u3002");
            break;
          }
        }
      } catch (failure) {
        const doneYet = segments.some((segment) => segment.status === "succeeded" && segment.videoUrl);
        if (failure?.code !== "ABORTED" || !doneYet) throw failure;
        interrupted = true;
        paused = true;
        notes.push(
          "\u8FD9\u6B21\u8C03\u7528\u88AB\u4E2D\u65AD\u4E86\uFF08\u7528\u6237\u70B9\u4E86\u505C\u6B62\uFF0C\u6216\u8005\u7B49\u8D85\u65F6\u4E86\uFF09\uFF1A\u5DF2\u7ECF\u5EF6\u957F\u597D\u7684\u90E8\u5206\u4F1A\u5148\u4E0B\u8F7D\u3001\u5408\u5E76\u3001\u4EA4\u4ED8\uFF0C\u5269\u4E0B\u7684\u6BB5\u4E0D\u7528\u91CD\u5934\u518D\u6765\u2014\u2014\u7528 resume \u5C31\u80FD\u63A5\u7740\u505A\u3002"
        );
      }
      const completed = segments.filter((segment) => segment.status === "succeeded" && segment.videoUrl);
      const deliveredSeconds = completed.reduce((sum, segment) => sum + (segment.seconds || 0), 0);
      const result = {
        status,
        error,
        errorCode,
        submissionId,
        convertedReferences,
        ...convertedReferences ? { nextAction: "present_reference_images_then_wait_for_user" } : {},
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        totalSeconds: deliveredSeconds
      };
      if (resume?.deliveryPending && doneBefore < fullPlan.length) paused = true;
      if (paused) {
        result.paused = true;
        result.remainingSeconds = Math.max(0, fullPlan.reduce((sum, step) => sum + step.seconds, 0) - completed.reduce((sum, step) => sum + step.seconds, 0));
      }
      result.resumeDir = segmentsDir;
      result.segmentsDir = segmentsDir;
      if (pendingTask) {
        result.pendingTaskId = pendingTask.taskId;
        result.note = "\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u7528 resume \u67E5\u8BE2\u5E76\u63A5\u56DE\u539F\u8FDB\u5EA6\uFF0C\u6216\u7528 video_status \u67E5\u8BE2\uFF1B\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u3002";
      }
      if (!completed.length) {
        if (notes.length) result.note = notes.join("\n");
        return result;
      }
      if (status !== "succeeded") {
        notes.push(`\u5DF2\u628A\u6210\u529F\u7684 ${completed.length} \u6BB5\uFF08${deliveredSeconds} \u79D2\uFF09\u4EA4\u4ED8\uFF0C\u53EF\u4F5C\u4E3A\u6B8B\u7247\u4F7F\u7528\u3002`);
        result.partial = true;
      }
      if (resume) {
        notes.push(
          `\u63A5\u7740\u4E0A\u4E00\u6B21\u6682\u505C\u7684\u8FDB\u5EA6\u7EE7\u7EED\uFF1A\u524D\u9762 ${doneBefore} \u6BB5\uFF08${formatSeconds(resume.cursor ?? 0)}\uFF09\u4E0D\u91CD\u65B0\u751F\u6210\uFF0C\u8FD9\u6B21\u8FD8\u8981\u5EF6\u957F ${plan.length} \u6BB5\u5171 ${plannedSeconds} \u79D2\u3002`
        );
      }
      if (args?.merge === false) {
        if (paused) {
          result.paused = true;
          result.remainingSeconds = Math.max(0, fullPlan.reduce((sum, step) => sum + step.seconds, 0) - deliveredSeconds);
          result.nextAction = "present_video_then_wait_for_user";
          notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        }
        result.note = [...notes, "\u6309\u53C2\u6570\u8981\u6C42\u53EA\u8FD4\u56DE\u4E0A\u6E38\u94FE\u63A5\uFF0C\u6CA1\u6709\u4E0B\u8F7D\u5408\u5E76\u3002"].join("\n");
        return result;
      }
      const delivery = await downloadSegmentsAndMerge(config2, {
        segments: completed,
        segmentsDir,
        outDir,
        stamp,
        notes,
        keepSingleFile: paused,
        // 被中断时请求信号已经 abort：收尾（下载 + 合并）不能被它打断，否则等于白生成。
        signal: interrupted || exec?.signal?.aborted ? void 0 : exec?.signal
      });
      if (delivery.error) {
        result.deliveryError = delivery.error;
        if (delivery.ffmpegMissing) {
          result.ffmpegMissing = true;
          result.installHint = delivery.installHint;
        }
        result.nextAction = "resume_delivery_without_regeneration";
        result.segmentsDir = delivery.segmentsDir;
        result.note = notes.join("\n");
        return result;
      }
      if (delivery.ffmpegMissing) {
        result.segmentsDir = delivery.segmentsDir;
        result.merged = false;
        result.ffmpegMissing = true;
        result.installHint = delivery.installHint;
        result.note = notes.join("\n");
        return result;
      }
      if (!delivery.files.length) {
        result.note = notes.join("\n");
        return result;
      }
      if (delivery.merged) {
        result.merged = true;
        result.videoPath = delivery.videoPath;
        result.mergeMode = delivery.mergeMode;
        if (delivery.actualSeconds) result.actualSeconds = delivery.actualSeconds;
        if (delivery.seamCuts?.length) result.seamCuts = delivery.seamCuts;
      }
      if (paused) {
        result.segmentsDir = segmentsDir;
        result.resumeDir = segmentsDir;
        result.paused = true;
        result.nextAction = "present_video_then_wait_for_user";
        result.previewPath = completed.at(-1)?.localPath || result.videoPath;
        await appendRequestLog({ event: "preview_required", previewPath: result.previewPath, resumeDir: result.resumeDir });
        result.remainingSeconds = Math.max(0, fullPlan.reduce((sum, step) => sum + step.seconds, 0) - deliveredSeconds);
        notes.push(`\u5DF2\u4EA4\u4ED8\u7684\u6210\u7247\u662F\u5230\u7B2C ${segments.length} \u6BB5\uFF0C\u5206\u6BB5\u4ECD\u4FDD\u7559\u5728 ${segmentsDir}\u3002`);
        notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        result.note = notes.join("\n");
        return result;
      }
      result.segmentsDir = segmentsDir;
      if (notes.length) result.note = notes.join("\n");
      return result;
    }
  };
}

// src/tools/video-status.ts
init_connection();
init_config();
function taskTool(liveConfig) {
  return {
    name: "video_status",
    description: "\u6309\u4EFB\u52A1 ID \u67E5\u8BE2 Seedance \u89C6\u9891\u4EFB\u52A1\uFF08\u751F\u6210\u3001\u5EF6\u957F\u4E0E\u5408\u5E76\uFF09\u7684\u72B6\u6001\uFF1B\u4EFB\u52A1\u5B8C\u6210\uFF08status \u4E3A succeeded\uFF09\u65F6\u8FD4\u56DE\u89C6\u9891\u4E0B\u8F7D\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\u3002video_generate / video_extend \u8FD4\u56DE timeout \u6216\u67D0\u6BB5 unknown\uFF08\u67E5\u8BE2\u5931\u8D25\u3001\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF09\u65F6\uFF0C\u7528\u5B83\u4EEC\u7ED9\u51FA\u7684 taskId \u5728\u8FD9\u91CC\u7EE7\u7EED\u7B49\u2014\u2014unknown \u53EA\u8868\u793A\u300C\u6CA1\u67E5\u5230\u300D\uFF0C\u4EFB\u52A1\u5F88\u53EF\u80FD\u8FD8\u5728\u751F\u6210\uFF0C\u4E0D\u8981\u56E0\u6B64\u91CD\u65B0\u63D0\u4EA4\u540C\u4E00\u6BB5\u4EFB\u52A1\u3002A/B\u63A5\u5165\u5728\u4EFB\u52A1\u6210\u529F\u540E\u8FD8\u4F1A\u67E5\u8BE2\u4E2D\u8F6C\u7AD9\u6700\u7EC8\u7ED3\u7B97\uFF1B\u5F85\u7ED3\u7B97\u6216\u8D39\u7528\u67E5\u8BE2\u5931\u8D25\u53EF\u7528\u540C\u4E00taskId\u8865\u67E5\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u3002",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "\u7531 video_generate / video_extend \u8FD4\u56DE\u7684\u4EFB\u52A1 ID\u3002"
        }
      },
      required: ["taskId"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          status: { type: "string" },
          model: { type: "string" },
          videoUrl: { type: "string" },
          error: { type: "string" },
          errorCode: { type: "string" }
        }
      },
      render(_args, value) {
        const { taskId, status, videoUrl, error, model } = value || {};
        if (status === "succeeded") {
          return [
            {
              type: "text",
              text: [
                "\u89C6\u9891\u4EFB\u52A1\u5DF2\u5B8C\u6210\u3002",
                `\u4EFB\u52A1 ID\uFF1A${taskId}`,
                `\u6A21\u578B\uFF1A${model || "-"}`,
                `\u89C6\u9891\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1A${artifactLink("\u89C2\u770B\u89C6\u9891", "", videoUrl) || "\uFF08\u65E0\uFF09"}`,
                "\u6B63\u6587\u987B\u4FDD\u7559\u4E0A\u8FF0\u53EF\u70B9\u51FB\u94FE\u63A5\uFF0C\u6709present\u5361\u7247\u4E5F\u4E0D\u80FD\u7701\u7565\uFF1B\u67E5\u8BE2\u4E0D\u4F1A\u91CD\u65B0\u751F\u6210\u89C6\u9891\u3002"
              ].join("\n")
            }
          ];
        }
        if (status === "failed") {
          return [{ type: "text", text: `\u89C6\u9891\u4EFB\u52A1\u5931\u8D25\uFF08\u4EFB\u52A1 ${taskId}\uFF09\uFF1A${error || "\u672A\u77E5\u9519\u8BEF"}` }];
        }
        if (status === "unknown") {
          const detail = String(error || "\u67E5\u8BE2\u5931\u8D25").replace(/。+$/, "");
          return [
            {
              type: "text",
              text: `\u4EFB\u52A1 ${taskId} \u8FD9\u6B21\u6CA1\u67E5\u5230\u72B6\u6001\uFF1A${detail}\u3002\u8FD9\u4E0D\u4EE3\u8868\u4EFB\u52A1\u6CA1\u6709\u751F\u6210\u2014\u2014\u7A0D\u540E\u91CD\u8BD5\uFF0C\u6216\u68C0\u67E5 Key / \u989D\u5EA6\u540E\u518D\u67E5\u4E00\u6B21\uFF0C\u4E0D\u8981\u91CD\u65B0\u63D0\u4EA4\u3002`
            }
          ];
        }
        return [{ type: "text", text: `\u4EFB\u52A1 ${taskId} \u5F53\u524D\u72B6\u6001\uFF1A${status || "\u672A\u77E5"}\u3002` }];
      }
    },
    timeoutMs: 6e4,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const config = snapshotConfig(liveConfig);
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);
      const taskId = String(args?.taskId ?? "").trim();
      if (!taskId) throw new Error("taskId \u4E0D\u80FD\u4E3A\u7A7A\u3002");
      let task;
      try {
        task = await getTask(config, taskId, exec?.signal);
      } catch (failure) {
        return {
          taskId,
          status: "unknown",
          errorCode: failure?.code || "provider_poll_error",
          error: `\u67E5\u8BE2\u5931\u8D25\uFF1A${failure?.message || failure}`
        };
      }
      const status = extractStatus(task) || "unknown";
      const model = findKey(task, ["model"]) || resolveModel(config);
      const videoUrl = extractVideoUrl(task);
      if (SUCCESS_STATES.has(status) && videoUrl) {
        return { taskId, status: "succeeded", model, videoUrl };
      }
      if (SUCCESS_STATES.has(status) && !videoUrl) {
        const imageUrl = extractImageUrl(task);
        return {
          taskId,
          status: "failed",
          model,
          errorCode: "provider_bad_response",
          error: imageUrl ? `\u4E0A\u6E38\u8FD4\u56DE\u7684\u662F\u56FE\u7247\u800C\u4E0D\u662F\u89C6\u9891\uFF08${imageUrl.split("?")[0].slice(-60)}\uFF09\u3002` : "\u4E0A\u6E38\u62A5\u544A\u6210\u529F\u4F46\u6CA1\u6709\u8FD4\u56DE\u89C6\u9891\u5730\u5740\u3002"
        };
      }
      if (FAILED_STATES.has(status)) {
        const detail = findKey(task, ["error", "fail_reason", "message", "detail"]);
        const classified = classifyError(
          400,
          typeof detail === "string" ? { message: detail } : detail || task
        );
        const raw = status === "cancelled" || status === "canceled" ? "cancelled" : "failed";
        return {
          taskId,
          status: raw,
          model,
          errorCode: classified.code,
          error: isContentRejection(classified.message) ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${classified.message}` : classified.message
        };
      }
      return { taskId, status, model, videoUrl };
    }
  };
}

// src/tools/video-setup.ts
function setupTool(config) {
  return {
    name: "video_setup",
    description: "\u68C0\u67E5\u672C\u673A\u6709\u6CA1\u6709 ffmpeg\uFF08\u751F\u6210\u8D85\u8FC7\u6A21\u578B\u5355\u6B21\u4E0A\u9650\u7684\u89C6\u9891\u65F6\uFF0C\u5408\u5E76\u6210\u4E00\u6761\u8981\u7528\u5B83\uFF09\uFF0C\u7F3A\u4E86\u5C31\u88C5\u3002install=true \u8868\u793A\u300C\u7528\u6237\u5DF2\u7ECF\u540C\u610F\u5B89\u88C5\u300D\uFF0C\u63D2\u4EF6\u4F1A\u6267\u884C\u5B89\u88C5\u547D\u4EE4\u5E76\u9A8C\u8BC1\u2014\u2014\u547D\u4EE4\u4F1A\u5148\u62FF\u7ED9\u7528\u6237\u786E\u8BA4\uFF0C\u7528\u6237\u70B9\u4E86\u5141\u8BB8\u624D\u6267\u884C\u3002\u88C5\u4E0D\u4E0A\uFF08\u4F8B\u5982\u672C\u673A\u8FDE\u5305\u7BA1\u7406\u5668\u90FD\u6CA1\u6709\uFF09\u4F1A\u8FD4\u56DE\u624B\u52A8\u5B89\u88C5\u6B65\u9AA4\u548C\u4E00\u4E2A nextStep\u3002\u7528\u6237\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u300C\u68C0\u67E5\u4E00\u4E0B\u73AF\u5883\u300D\u65F6\u7528\u5B83\uFF1B\u53EA\u6709\u786E\u5B9E\u8981\u88C5\u624D\u4F20 install=true\u3002",
    parameters: {
      type: "object",
      properties: {
        install: {
          type: "boolean",
          description: "\u662F\u5426\u6267\u884C\u5B89\u88C5\uFF0C\u9ED8\u8BA4 false\uFF08\u53EA\u68C0\u67E5\u3001\u53EA\u6C47\u62A5\uFF0C\u4E0D\u52A8\u672C\u673A\uFF09\u3002"
        },
        target: {
          type: "string",
          enum: ["ffmpeg", "package-manager"],
          description: "install=true \u65F6\u88C5\u4EC0\u4E48\uFF1Affmpeg\uFF08\u9ED8\u8BA4\uFF09\u6216\u5148\u88C5\u5305\u7BA1\u7406\u5668\uFF08macOS \u7684 Homebrew\uFF09\u3002"
        }
      }
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          os: { type: "string" },
          ffmpegVersion: { type: "string" },
          ffmpegPath: { type: "string" },
          ffprobeVersion: { type: "string" },
          installCommand: { type: "string" },
          manualSteps: { type: "array", items: { type: "string" } },
          output: { type: "string" },
          note: { type: "string" }
        }
      },
      render(_args, value) {
        const {
          status,
          os: os3,
          ffmpegVersion,
          ffmpegPath,
          ffprobeVersion,
          installCommand,
          output,
          note
        } = value || {};
        const lines = [];
        if (status === "ready") {
          lines.push("\u672C\u673A\u73AF\u5883\u6CA1\u95EE\u9898\uFF1Affmpeg \u5DF2\u7ECF\u80FD\u7528\u4E86\uFF0C\u957F\u89C6\u9891\u53EF\u4EE5\u76F4\u63A5\u5408\u5E76\u6210\u4E00\u6761\u3002");
        } else if (status === "installed") {
          lines.push("ffmpeg \u88C5\u597D\u4E86\uFF0C\u957F\u89C6\u9891\u73B0\u5728\u53EF\u4EE5\u5408\u5E76\u6210\u4E00\u6761\u3002");
        } else if (status === "missing") {
          lines.push("\u672C\u673A\u8FD8\u6CA1\u6709 ffmpeg\uFF1A\u751F\u6210\u8D85\u8FC7\u6A21\u578B\u5355\u6B21\u4E0A\u9650\u7684\u89C6\u9891\u65F6\u53EA\u80FD\u7ED9\u5206\u6BB5\uFF0C\u6CA1\u6CD5\u5408\u5E76\u6210\u4E00\u6761\u3002");
          lines.push(`\u88C5\u4E00\u4E0B\u5C31\u597D\uFF08${os3 || "\u5F53\u524D\u7CFB\u7EDF"}\uFF09\uFF1A${installCommand || ""}`);
          lines.push("\u7528\u6237\u540C\u610F\u7684\u8BDD\uFF0C\u6211\u53EF\u4EE5\u7528 video_setup\uFF08install=true\uFF09\u76F4\u63A5\u5E2E\u4ED6\u88C5\u3002");
        } else if (status === "failed") {
          lines.push("ffmpeg \u6CA1\u88C5\u6210\u529F\uFF0C\u5F97\u624B\u52A8\u88C5\u4E00\u4E0B\u3002");
          lines.push(`\u624B\u52A8\u6B65\u9AA4\uFF1A${note || installCommand || ""}`);
        } else {
          lines.push(`\u73AF\u5883\u68C0\u67E5\u7ED3\u679C\uFF1A${status || "\u672A\u77E5"}\u3002`);
        }
        if (ffmpegVersion) lines.push(`ffmpeg\uFF1A${ffmpegVersion}`);
        if (ffmpegPath) lines.push(`ffmpeg \u8DEF\u5F84\uFF1A${ffmpegPath}\uFF08\u53EF\u4EE5\u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\uFF09`);
        if (ffprobeVersion) lines.push(`ffprobe\uFF1A${ffprobeVersion}`);
        if (status !== "ready" && status !== "installed" && installCommand && status === "failed") {
          lines.push(`\u547D\u4EE4\uFF1A${installCommand}`);
        }
        if (output) lines.push(`\u5B89\u88C5\u8F93\u51FA\uFF08\u672B\u5C3E\uFF09\uFF1A${output}`);
        if (note) lines.push(note);
        return [{ type: "text", text: lines.filter(Boolean).join("\n") }];
      }
    },
    // 装 ffmpeg 可能要下载几十 MB，给足时间；装完还要再验证一次。
    timeoutMs: 20 * 60 * 1e3,
    isConcurrencySafe() {
      return false;
    },
    async execute(args, exec) {
      const signal = exec?.signal;
      const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
      const probeBinary = resolveBinary(config, "ffprobeBinary", "ffprobe");
      const { os: os3, installs, bootstrap } = ffmpegInstallOptions();
      const wantsInstall = args?.install === true;
      const target = String(args?.target || "ffmpeg");
      const manualSteps = installs.map((item) => `${item.label}\uFF1A${item.command}`);
      const installCommand = target === "package-manager" && bootstrap ? bootstrap.command : installs[0].command;
      const ffmpegVersion = await probeBinaryVersion(binary, signal);
      const ffprobeVersion = await probeBinaryVersion(probeBinary, signal);
      const base = { os: os3, installCommand, manualSteps, ffmpegVersion, ffprobeVersion };
      if (ffmpegVersion) {
        const note = ffprobeVersion ? "ffmpeg \u4E0E ffprobe \u90FD\u53EF\u7528\uFF0C\u957F\u89C6\u9891\u4F1A\u6B63\u5E38\u5408\u5E76\u6210\u4E00\u6761\u3002" : "ffmpeg \u53EF\u7528\uFF1B\u6CA1\u6709 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u88AB\u8DF3\u8FC7\uFF08\u4E0D\u5F71\u54CD\u5408\u5E76\uFF09\u3002";
        return { status: "ready", ...base, ffmpegPath: binary, note };
      }
      if (!wantsInstall) {
        return {
          status: "missing",
          ...base,
          note: `\u672C\u673A ${binary} \u8DD1\u4E0D\u8D77\u6765\u3002\u7528\u6237\u540C\u610F\u540E\u53EF\u4EE5 install=true \u8BA9\u6211\u6765\u88C5\uFF1B\u4E5F\u6709\u53EF\u80FD\u662F\u8DEF\u5F84\u4E0D\u5BF9\uFF1A\u5DF2\u7ECF\u88C5\u8FC7\u5C31\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u3002`
        };
      }
      let output = "";
      try {
        const shellCommand = target === "package-manager" && bootstrap ? bootstrap.command : target === "package-manager" && !bootstrap ? null : installs[0].command;
        if (!shellCommand) {
          return {
            status: "failed",
            ...base,
            note: `${os3} \u4E0D\u9700\u8981\u53E6\u5916\u88C5\u5305\u7BA1\u7406\u5668\uFF0C\u76F4\u63A5\u7528\u7CFB\u7EDF\u81EA\u5E26\u7684\u5305\u7BA1\u7406\u5668\u88C5 ffmpeg \u5C31\u884C\u3002`
          };
        }
        const result = await runProcess(shellCommand, [], {
          signal,
          shell: true,
          timeoutMs: 18 * 60 * 1e3
        });
        output = tail(String(result.stdout || "") + String(result.stderr || ""), 800);
      } catch (error) {
        output = tail(error?.message || String(error), 800);
      }
      const afterVersion = await probeBinaryVersion(binary, signal);
      if (afterVersion) {
        return {
          status: "installed",
          ...base,
          ffmpegVersion: afterVersion,
          ffmpegPath: binary,
          output,
          note: "\u88C5\u597D\u4E86\uFF1A\u76F4\u63A5\u91CD\u8DD1\u521A\u624D\u90A3\u6B21\u751F\u6210\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\u6210\u4E00\u6761\uFF08\u5206\u6BB5\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\u3002"
        };
      }
      const found = await findInstalledFfmpeg(signal);
      if (found) {
        return {
          status: "installed",
          ...base,
          ffmpegVersion: await probeBinaryVersion(found, signal),
          ffmpegPath: found,
          output,
          note: `\u88C5\u597D\u4E86\uFF0C\u4F46\u6CA1\u8FDB PATH\uFF1A\u628A ${found} \u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\uFF08\u6216\u8005\u91CD\u5F00\u4E00\u4E2A\u7EC8\u7AEF\u518D\u91CD\u8DD1\u4E00\u6B21\u751F\u6210\uFF09\u3002`
        };
      }
      const needsBootstrap = Boolean(bootstrap) && !ffmpegVersion && /command not found|not found|不是内部或外部命令|未找到/i.test(output);
      return {
        status: "failed",
        ...base,
        installCommand: needsBootstrap ? bootstrap.command : installs[0].command,
        manualSteps: needsBootstrap ? [`\u5148\u88C5\u5305\u7BA1\u7406\u5668\uFF1A${bootstrap.command}`, ...manualSteps] : manualSteps,
        output,
        note: needsBootstrap ? `\u672C\u673A\u6CA1\u6709 ${os3} \u7684\u5305\u7BA1\u7406\u5668\uFF0C\u5F97\u5148\u88C5\u5B83\uFF1A${bootstrap.command}\uFF1B\u88C5\u597D\u4E4B\u540E\u518D\u88C5 ffmpeg\u3002\u8FD9\u4E24\u6B65\u90FD\u53EF\u4EE5\u8BA9\u6211\u6765\u505A \u2014\u2014 \u8BF4\u4E00\u58F0\u5C31\u884C\u3002` : "\u5B89\u88C5\u547D\u4EE4\u6CA1\u6210\u529F\uFF08\u53EF\u80FD\u662F\u6CA1\u6743\u9650\u3001\u6CA1\u8054\u7F51\u6216\u88AB\u5B89\u5168\u7B56\u7565\u62E6\u4E0B\uFF09\u3002\u4E0A\u9762\u662F\u624B\u52A8\u6B65\u9AA4\uFF0C\u7167\u7740\u5728\u7EC8\u7AEF\u91CC\u8DD1\u4E00\u904D\u5373\u53EF\u3002"
      };
    }
  };
}

// src/internal/hyperframes.ts
import { spawn as spawn2 } from "node:child_process";
import path12 from "node:path";
import { createRequire as createRequire2 } from "node:module";
import { stat as stat6, mkdir as mkdir9 } from "node:fs/promises";
function runHyperframes(cli, args, cwd, config, signal) {
  return new Promise((resolve3, reject) => {
    if (signal?.aborted) return reject(new Error("Hyperframes \u5DF2\u53D6\u6D88\u3002"));
    let output = "";
    const child = spawn2(process.execPath, [cli, ...args], {
      cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        CI: "1",
        HYPERFRAMES_NO_TELEMETRY: "1",
        ...Object.fromEntries([
          ["HYPERFRAMES_FFMPEG_PATH", resolveBinary(config, "ffmpegBinary", "ffmpeg")],
          ["HYPERFRAMES_FFPROBE_PATH", resolveBinary(config, "ffprobeBinary", "ffprobe")]
        ].filter(([, binary]) => path12.isAbsolute(binary)))
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const collect = (data) => {
      output = (output + data.toString()).slice(-24e3);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    let stopped;
    let forceKill;
    const stop = (reason) => {
      if (stopped) return;
      stopped = new Error(reason);
      child.kill("SIGTERM");
      forceKill = setTimeout(() => child.kill("SIGKILL"), 5e3);
      forceKill.unref();
    };
    const abort = () => stop("Hyperframes \u5DF2\u53D6\u6D88\u3002");
    const timer = setTimeout(() => stop("Hyperframes \u6267\u884C\u8D85\u8FC7 20 \u5206\u949F\uFF0C\u5DF2\u505C\u6B62\u3002"), 20 * 60 * 1e3);
    const cleanup = () => {
      clearTimeout(timer);
      if (forceKill) clearTimeout(forceKill);
      signal?.removeEventListener("abort", abort);
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("close", (code) => {
      cleanup();
      if (stopped) reject(stopped);
      else resolve3({ code: code ?? 1, output });
    });
  });
}
function hyperframesTool(config, deps) {
  return {
    name: "video_hyperframes",
    description: "\u7528 Hyperframes \u5C06\u672C\u5730 HTML/CSS \u52A8\u753B\u3001\u5B57\u5E55\u548C\u7D20\u6750\u6E32\u67D3\u6210 MP4\u3002action=check \u68C0\u67E5\u73AF\u5883\uFF1Blint \u6821\u9A8C\u9879\u76EE\uFF1Brender \u51FA\u7247\u3002\u9879\u76EE\u76EE\u5F55\u987B\u5305\u542B index.html\uFF1B\u5148\u4FDD\u5B58\u5E76\u5C55\u793A\u5B8C\u6574\u811A\u672C\u3001\u901A\u8FC7\u811A\u672C\u5BA1\u6838\u4E0E\u5236\u4F5C\u786E\u8BA4\uFF0C\u518D render\u3002\u52A8\u753B\u987B\u53EF\u6309\u65F6\u95F4\u5B9A\u4F4D\uFF0C\u4E0D\u80FD\u7528\u5B9E\u65F6\u65F6\u949F\u9A71\u52A8\u3002\u590D\u7528\u5BBF\u4E3B Node \u8FD0\u884C\u65F6\uFF0C\u65E0\u9700\u5BA2\u6237\u8FD0\u884C npm/npx\u3002\u9996\u6B21\u6E32\u67D3\u53EF\u80FD\u4E0B\u8F7D Chromium\uFF0C\u9700\u8981\u7F51\u7EDC\u3002\u5B83\u4E0D\u4EE3\u66FF Seedance \u7684\u5B9E\u62CD\u753B\u9762\u751F\u6210\uFF0C\u4E0D\u8C03\u7528\u4ED8\u8D39\u89C6\u9891 API\u3002",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["check", "lint", "render"], description: "\u9ED8\u8BA4 check\u3002" },
        projectDir: { type: "string", description: "\u5DF2\u6709 Hyperframes \u9879\u76EE\u76EE\u5F55\uFF0C\u7EDD\u5BF9\u8DEF\u5F84\u6216\u76F8\u5BF9\u5F53\u524D\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\uFF1Blint/render \u5FC5\u586B\u3002" },
        output: { type: "string", description: "\u76F8\u5BF9\u9879\u76EE\u76EE\u5F55\u7684 MP4 \u8F93\u51FA\u8DEF\u5F84\uFF1B\u9ED8\u8BA4 renders/output-\u65F6\u95F4\u6233.mp4\uFF0C\u5DF2\u5B58\u5728\u65F6\u62D2\u7EDD\u8986\u76D6\u3002" },
        fps: { type: "integer", enum: [24, 25, 30, 50, 60], description: "\u9ED8\u8BA4 30\u3002" }
      }
    },
    output: {
      schema: { type: "object", properties: {
        status: { type: "string" },
        action: { type: "string" },
        output: { type: "string" },
        videoPath: { type: "string" },
        nodeVersion: { type: "string" },
        note: { type: "string" }
      } },
      render(_args, value) {
        return [{ type: "text", text: JSON.stringify(value, null, 2) }];
      }
    },
    timeoutMs: 21 * 60 * 1e3,
    isConcurrencySafe() {
      return false;
    },
    async execute(args, exec) {
      const action = args.action || "check";
      if (!["check", "lint", "render"].includes(action)) throw new Error("\u4E0D\u652F\u6301\u7684 Hyperframes \u64CD\u4F5C\u3002");
      const [major, minor] = process.versions.node.split(".").map(Number);
      if (major < 22 || major === 22 && minor < 12) return {
        status: "runtime_unsupported",
        nodeVersion: process.versions.node,
        note: "Hyperframes \u53CA\u5176\u6D4F\u89C8\u5668\u4F9D\u8D56\u9700\u8981 Node 22.12+\u3002\u8BF7\u5347\u7EA7\u5230\u63D0\u4F9B\u517C\u5BB9\u8FD0\u884C\u65F6\u7684 Harness \u684C\u9762\u7AEF\uFF1B\u63D2\u4EF6\u4E0D\u4F1A\u8C03\u7528\u7CFB\u7EDF node \u6216\u81EA\u52A8\u5B89\u88C5 Node\u3002"
      };
      let cli;
      try {
        const require2 = createRequire2(import.meta.url);
        cli = path12.join(path12.dirname(require2.resolve("hyperframes/package.json")), "bin/hyperframes.mjs");
      } catch {
        return { status: "dependency_missing", note: "Hyperframes \u4E3A\u5185\u90E8\u5F00\u53D1\u80FD\u529B\uFF0C\u516C\u5F00\u63D2\u4EF6\u5305\u4E0D\u5305\u542B\u8BE5\u4F9D\u8D56\uFF1B\u9700\u5728\u5F00\u53D1\u73AF\u5883\u5355\u72EC\u51C6\u5907\u3002" };
      }
      let cwd = process.cwd();
      if (deps.workdir && exec?.agent) cwd = await deps.workdir.ensure(exec.agent, exec.signal) || cwd;
      const project = path12.resolve(cwd, args.projectDir || ".");
      if (action !== "check") {
        if (!args.projectDir) throw new Error("lint/render \u5FC5\u987B\u6307\u5B9A projectDir\u3002");
        if (!(await stat6(path12.join(project, "index.html"))).isFile()) throw new Error("\u9879\u76EE\u7F3A\u5C11 index.html\u3002");
      }
      let videoPath;
      let command = ["doctor", "--json"];
      if (action === "lint") command = ["lint", project, "--json"];
      if (action === "render") {
        if (args.fps !== void 0 && ![24, 25, 30, 50, 60].includes(args.fps)) throw new Error("\u4E0D\u652F\u6301\u7684\u5E27\u7387\u3002");
        const output = args.output || `renders/output-${Date.now()}.mp4`;
        videoPath = path12.resolve(project, output);
        const relative = path12.relative(project, videoPath);
        if (!relative || relative === ".." || relative.startsWith(`..${path12.sep}`) || path12.isAbsolute(relative) || path12.extname(videoPath).toLowerCase() !== ".mp4") {
          throw new Error("\u8F93\u51FA\u5FC5\u987B\u662F\u9879\u76EE\u76EE\u5F55\u5185\u7684 .mp4 \u6587\u4EF6\u3002");
        }
        try {
          await stat6(videoPath);
          throw new Error("\u8F93\u51FA\u6587\u4EF6\u5DF2\u5B58\u5728\uFF0C\u8BF7\u6362\u4E00\u4E2A\u6587\u4EF6\u540D\u3002");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        await mkdir9(path12.dirname(videoPath), { recursive: true });
        command = ["render", project, "--output", videoPath, "--fps", String(args.fps || 30), "--workers", "1", "--strict"];
      }
      const result = await runHyperframes(cli, command, action === "check" ? cwd : project, config, exec?.signal);
      if (result.code !== 0) return { status: "failed", action, output: result.output, note: "\u68C0\u67E5\u8F93\u51FA\u4E2D\u7684\u73AF\u5883\u6216\u9879\u76EE\u9519\u8BEF\u540E\u91CD\u8BD5\uFF1B\u4E0D\u4F1A\u91CD\u590D\u63D0\u4EA4 Seedance \u4EFB\u52A1\u3002" };
      if (videoPath && !(await stat6(videoPath)).size) throw new Error("Hyperframes \u672A\u751F\u6210\u6709\u6548\u7684 MP4 \u6587\u4EF6\u3002");
      return { status: action === "render" ? "succeeded" : "checked", action, output: result.output, ...videoPath ? { videoPath } : {} };
    }
  };
}

// src/tools/video-estimate.ts
init_config();
init_connection();
var RATES = [
  ["doubao-seedance-2-0-mini", [23, 14]],
  ["doubao-seedance-2-0-fast", [37, 22]],
  ["doubao-seedance-2-0", [46, 28]],
  ["doubao-seedance-2-5", [70, 42]]
];
var PRICE_DATE = "2026-11-01";
function compareVideoCosts(config, args) {
  const duration = args?.duration;
  if (!Number.isInteger(duration) || duration < 4 || duration > 120) throw new Error("\u76EE\u6807\u65F6\u957F\u987B\u4E3A4\u2013120\u79D2\u6574\u6570\u3002");
  if (!["480p", "720p"].includes(args?.resolution)) throw new Error("\u8BF7\u5148\u7531\u7528\u6237\u786E\u8BA4480P\u6216720P\uFF0C\u518D\u8BD5\u7B97\u3002");
  const ratio = args?.ratio ?? ref(config, "ratio", "9:16");
  if (!["16:9", "9:16"].includes(ratio)) throw new Error("\u5F53\u524D\u4EC5\u670916:9\u548C9:16\u7684\u50CF\u7D20\u8BA1\u8D39\u4F9D\u636E\uFF0C\u5176\u4ED6\u753B\u5E45\u9700\u6838\u5BF9\u5B9E\u9645\u5BBD\u9AD8\u540E\u8BD5\u7B97\uFF0C\u4E0D\u80FD\u5957\u7528\u6A2A\u5C4F\u4EF7\u683C\u3002");
  const model = resolveModel(config);
  const rates = RATES.find(([prefix]) => model.startsWith(prefix));
  if (!rates) throw new Error(`\u5C1A\u65E0${model}\u7684\u53EF\u9760\u4EF7\u76EE\uFF0C\u4E0D\u80FD\u5957\u7528\u5176\u4ED6\u6A21\u578B\u62A5\u4EF7\u3002`);
  const planned = resolveTargetPlan(config, args);
  if (planned.total !== duration) throw new Error("\u8BE5\u65F6\u957F\u8D85\u51FA\u5F53\u524D\u5206\u6BB5\u65B9\u6848\u80FD\u529B\uFF0C\u8BF7\u5148\u8C03\u6574\u5206\u6BB5\u8BA1\u5212\u3002");
  const groupRatio = args?.groupRatio ?? (isVolcengine(config) || isMetaontic(config) ? 1 : ref(config, "estimateGroupRatio", 0.8));
  if (!Number.isFinite(groupRatio) || groupRatio < 0 || groupRatio > 10) throw new Error("\u5206\u7EC4\u500D\u7387\u987B\u4E3A0\u201310\u7684\u6709\u6548\u6570\u5B57\u3002");
  if (isVolcengine(config) && groupRatio !== 1) throw new Error("\u706B\u5C71\u76F4\u8FDE\u4E0D\u9002\u7528\u4E2D\u8F6C\u5206\u7EC4\u6298\u6263\u3002");
  const officialModel = "doubao-seedance-2-5";
  const officialRates = RATES.find(([prefix]) => officialModel.startsWith(prefix))[1];
  const officialPlan = Array.from({ length: Math.ceil(duration / 30) }, (_step, index) => ({
    kind: index ? "extend" : "generate",
    seconds: 30
  }));
  function calculate(id, plan, price, multiplier) {
    const pixels = args.resolution === "720p" ? [1280, 720] : id.startsWith("doubao-seedance-2-5") ? [854, 480] : [864, 496];
    const dimensions = ratio === "9:16" ? [...pixels].reverse() : pixels;
    const segments = plan.map((step, index) => {
      const inputSeconds = index ? plan[index - 1].seconds : 0;
      const tokens = (inputSeconds + step.seconds) * pixels[0] * pixels[1] * 24 / 1024;
      const rateCnyPerMillion = price[inputSeconds ? 1 : 0] * multiplier;
      return { index: index + 1, kind: step.kind, seconds: step.seconds, inputSeconds, billingMode: inputSeconds ? "with_video_input" : "without_video_input", tokens, rateCnyPerMillion, cny: tokens * rateCnyPerMillion / 1e6 };
    });
    return { model: id, dimensions, groupRatio: multiplier, segments, cny: Math.round(segments.reduce((sum, s) => sum + s.cny, 0) * 1e4) / 1e4 };
  }
  return {
    duration,
    resolution: args.resolution,
    ratio,
    fps: 24,
    priceDate: PRICE_DATE,
    currency: "CNY",
    estimateType: "\u57FA\u7840\u516C\u5F0F\u4F30\u4EF7",
    official: calculate(officialModel, officialPlan, officialRates, 1),
    plugin: calculate(model, planned.plan, rates[1], groupRatio),
    pluginChannel: isVolcengine(config) ? "\u706B\u5C71\u76F4\u8FDE\uFF08\u65E0\u4E2D\u8F6C\u6298\u6263\uFF09" : "MetaOnticVideo\u4E2D\u8F6C\u5236\u4F5C\u65B9\u6848",
    sources: ["https://docs.volcengine.com/docs/ark/model-pricing?lang=zh", "https://ai.bileego.com/pricing"],
    notes: ["\u8FD9\u662F\u89C6\u9891API\u57FA\u7840\u516C\u5F0F\u4F30\u4EF7\uFF0C\u975E\u56FA\u5B9A\u62A5\u4EF7\uFF1B\u542B\u89C6\u9891\u8F93\u5165\u7684\u6700\u4F4E\u7528\u91CF\u8865\u8DB3\u5C1A\u672A\u8BA1\u5165\uFF0C\u5B9E\u9645\u4EE5\u6E20\u9053\u8D26\u5355\u4E3A\u51C6\u3002", "\u7EED\u62CD\u8F93\u5165\u6309\u4E0A\u4E00\u6BB5\u5B8C\u6574\u89C6\u9891\u65F6\u957F\u8BA1\u5165\uFF0C\u4E0D\u6309\u7D2F\u8BA1\u6210\u7247\u8F93\u5165\uFF1B\u53C2\u8003\u56FE\u7247\u4E0D\u7B49\u540C\u53C2\u8003\u89C6\u9891\uFF0C\u4E0D\u4F7F\u7528\u542B\u89C6\u9891\u5355\u4EF7\u3002", "\u4E0D\u542B\u56FE\u7247\u751F\u6210\u6216\u8F6C\u6362\u3001\u91CD\u8BD5\u3001\u72EC\u7ACB\u914D\u97F3\u53CA\u5176\u4ED6\u989D\u5916\u8C03\u7528\uFF1B\u672C\u5730\u5408\u5E76\u4E0D\u4EA7\u751F\u89C6\u9891\u6A21\u578B\u8C03\u7528\u8D39\uFF0C\u63A5\u7F1D\u88C1\u526A\u4F1A\u7F29\u77ED\u4EA4\u4ED8\u65F6\u957F\u3002", "\u4E0D\u540C\u6A21\u578B\u7684\u8D28\u91CF\u4E0E\u80FD\u529B\u6709\u5DEE\u5F02\uFF1B\u706B\u5C71\u5B98\u65B9\u4E3AAPI\u520A\u4F8B\u4EF7\uFF0C\u4E0D\u662F\u7F51\u9875\u79EF\u5206\u6216\u5957\u9910\u4EF7\u683C\u3002", "\u706B\u5C71\u5B98\u65B9\u65B9\u6848\u6309\u6BCF\u6BB5 30 \u79D2\u8BA1\uFF1A\u4E0D\u8DB3 30 \u79D2\u7684\u5C3E\u6BB5\u4E5F\u6309 30 \u79D2\u8BA1\u8D39\uFF0C\u4E0D\u6309\u5269\u4F59\u79D2\u6570\u6298\u534A\u3002", "\u4E2D\u8F6C\u500D\u7387\u4EC5\u5728Key\u786E\u6709\u5BF9\u5E94\u5206\u7EC4\u6743\u9650\u4E14\u5B9E\u9645\u4F7F\u7528\u8BE5\u5206\u7EC4\u65F6\u6210\u7ACB\uFF1B\u4EF7\u683C\u65E5\u671F\u540E\u53EF\u80FD\u8C03\u6574\uFF0C\u5236\u4F5C\u524D\u9700\u590D\u6838\u3002"]
  };
}
function estimateTool(config) {
  return {
    name: "video_estimate",
    description: "\u811A\u672C\u5BA1\u6838\u524D\u5FC5\u987B\u8C03\u7528\u7684\u53EA\u8BFB\u53CC\u65B9\u6848\u8D39\u7528\u8BD5\u7B97\uFF1A\u706B\u5C71\u5B98\u65B9\u65B9\u6848\u4E0E\u5F53\u524DMetaOnticVideo\u63D2\u4EF6\u65B9\u6848\u3002duration\u4E3A\u5B8C\u6574\u76EE\u6807\u65F6\u957F\uFF0Cresolution\u987B\u7528\u6237\u5DF2\u786E\u8BA4\uFF1B\u9996\u6BB5\u6309\u65E0\u89C6\u9891\u8F93\u5165\uFF0C\u540E\u7EED\u7EED\u62CD\u6309\u6709\u89C6\u9891\u8F93\u5165\u8BA1\u4EF7\u5E76\u8BA1\u5165\u4E0A\u4E00\u6BB5\u5B8C\u6574\u89C6\u9891\u65F6\u957F\uFF1B\u53C2\u8003\u56FE\u4E0D\u7B97\u89C6\u9891\u8F93\u5165\u3002\u5FC5\u987B\u5728\u811A\u672C\u672B\u5C3E\u5C55\u793A\u9010\u6BB5\u6863\u4F4D\u3001\u8F93\u5165/\u8F93\u51FA\u79D2\u6570\u3001\u5355\u4EF7\u53CA\u91D1\u989D\uFF0C\u4E0D\u80FD\u53EA\u7ED9\u5408\u8BA1\u3002\u4E0D\u4F1A\u751F\u6210\u89C6\u9891\u3001\u6263\u8D39\u3001\u67E5\u4F59\u989D\u6216\u4FEE\u6539\u914D\u7F6E\u3002\u672A\u77E5\u6A21\u578B/\u753B\u5E45\u62D2\u7EDD\u731C\u4EF7\u3002\u6BCF\u6B21\u6539\u7A3F\u6D89\u53CA\u65F6\u957F\u3001\u6E05\u6670\u5EA6\u3001\u6A21\u578B\u6216\u5206\u6BB5\u987B\u91CD\u7B97\u3002",
    parameters: { type: "object", properties: {
      duration: { type: "integer", minimum: 4, maximum: 120, description: "\u5F53\u524D\u5B8C\u6574\u811A\u672C\u7684\u76EE\u6807\u603B\u65F6\u957F" },
      resolution: { type: "string", enum: ["480p", "720p"], description: "\u7528\u6237\u5DF2\u786E\u8BA4\u7684\u89C6\u9891\u6E05\u6670\u5EA6" },
      ratio: { type: "string", enum: ["16:9", "9:16"], description: "\u811A\u672C\u753B\u5E45\uFF0C\u5176\u4ED6\u753B\u5E45\u6682\u4E0D\u53EF\u9760\u8BD5\u7B97" },
      segmentSeconds: { type: "integer", minimum: 4, maximum: 30, description: "\u4E0E\u5B9E\u9645\u751F\u6210\u4E00\u81F4\u7684\u7EED\u62CD\u5206\u6BB5\u65F6\u957F\u4E0A\u9650" },
      groupRatio: { type: "number", minimum: 0, maximum: 10, description: "\u4EC5\u5728\u5DF2\u6838\u5BF9Key\u5206\u7EC4\u6743\u9650\u548C\u5B9E\u9645\u500D\u7387\u65F6\u4F20\u5165\uFF1B\u4E0D\u5F97\u4E3A\u4E86\u663E\u793A\u4F4E\u4EF7\u5047\u8BBE0.8" }
    }, required: ["duration", "resolution"] },
    output: { schema: { type: "object" }, render(_args, value) {
      const detail = (name, item) => item.segments.map((s) => `${name}\u7B2C${s.index}\u6BB5\uFF1A${s.inputSeconds ? "\u6709\u89C6\u9891\u8F93\u5165" : "\u65E0\u89C6\u9891\u8F93\u5165"}\uFF1B\u8F93\u5165${s.inputSeconds}\u79D2 + \u8F93\u51FA${s.seconds}\u79D2\uFF1B\u5355\u4EF7\xA5${s.rateCnyPerMillion}/\u767E\u4E07token\uFF1B\u7EA6\xA5${s.cny.toFixed(4)}`);
      const line = (name, item) => `${name}\uFF1A\u7EA6\xA5${item.cny.toFixed(2)}\uFF1B${item.model}\uFF1B${item.segments.map((s) => s.seconds).join("+")}\u79D2\uFF1B\u500D\u7387${item.groupRatio}`;
      return [{ type: "text", text: [`${value.duration}\u79D2 / ${value.resolution.toUpperCase()} / ${value.ratio}\uFF08${value.estimateType}\uFF09`, line("\u706B\u5C71\u5B98\u65B9\u65B9\u6848", value.official), line("MetaOnticVideo\u63D2\u4EF6\u65B9\u6848", value.plugin), ...detail("\u706B\u5C71\u5B98\u65B9", value.official), ...detail("\u63D2\u4EF6", value.plugin), `\u4EF7\u683C\u6838\u5BF9\u65E5\u671F\uFF1A${value.priceDate}`, ...value.notes].join("\n") }];
    } },
    isConcurrencySafe() {
      return true;
    },
    async execute(args) {
      return compareVideoCosts(config, args);
    }
  };
}

// src/tools/video-config.ts
init_connection_defaults();
init_config();
init_connection();
var CONFIG_FIELDS = [
  "connectionMode",
  "metaonticApiKey",
  "volcengineApiKey",
  "apiKey",
  "baseUrl",
  "submitPath",
  "queryPath",
  "model",
  "imageModel",
  "imageUseVideoKey",
  "imageApiKey",
  "duration",
  "singleMaxSeconds",
  "ratio",
  "generateAudio",
  "watermark",
  "extraParams",
  "pollIntervalMs",
  "maxWaitMs",
  "pollErrorRetries",
  "seamTrimSeconds",
  "mergeMode",
  "outputDir",
  "resumeLockStaleMinutes",
  "ffmpegBinary",
  "ffprobeBinary",
  "registerEmail",
  "registerApi",
  "deviceId",
  "estimateGroupRatio"
];
var READ_ONLY_CONFIG_FIELDS = /* @__PURE__ */ new Set(["apiKey", "keyOrigin", "deviceId", "deviceSecret"]);
function maskSecrets(view) {
  return {
    ...view,
    metaonticApiKey: view.metaonticApiKey ? "\uFF08\u5DF2\u914D\u7F6E\uFF09" : "",
    volcengineApiKey: view.volcengineApiKey ? "\uFF08\u5DF2\u914D\u7F6E\uFF09" : "",
    imageApiKey: view.imageApiKey ? "\uFF08\u5DF2\u914D\u7F6E\uFF09" : "",
    apiKey: view.apiKey ? "\uFF08\u5DF2\u914D\u7F6E\uFF09" : "",
    deviceSecret: view.deviceSecret ? "\uFF08\u5DF2\u914D\u7F6E\uFF09" : ""
  };
}
function configView(config) {
  const stored = {};
  for (const key of CONFIG_FIELDS) stored[key] = ref(config, key, void 0);
  return {
    stored: maskSecrets(stored),
    effective: {
      connectionMode: isMetaontic(config) ? "metaontic" : isVolcengine(config) ? "volcengine" : "service",
      baseUrl: resolveBaseUrl(config),
      submitPath: resolveSubmitPath(config),
      queryPath: isVolcengine(config) ? "/api/v3/contents/generations/tasks/{task_id}" : String(ref(config, "queryPath", "")).trim() || relayPreset().queryPath,
      model: resolveModel(config),
      imageUseVideoKey: !isMetaontic(config) || ref(config, "imageUseVideoKey", true),
      imageModel: ref(config, "imageModel", "doubao-seedream-5-0-260128"),
      // 密钥只有一种合法来源：设置页「登录」时服务端下发
      apiKeySource: isMetaontic(config) ? resolveApiKey(config) ? "metaontic" : "missing" : isVolcengine(config) ? resolveApiKey(config) ? "volcengine" : "missing" : ref(config, "apiKey", "") ? isServerIssuedKey(config) ? "register" : "unverified" : "missing"
    }
  };
}
function normalizeConnectionPatch(config, input) {
  const patch = { ...input };
  if (patch.connectionMode === void 0) return { ...patch, ...connectionDefaults({ ...Object.fromEntries(Object.keys(config || {}).map((key) => [key, ref(config, key, void 0)])), ...patch }) };
  const mode = patch.connectionMode;
  if (!["service", "metaontic", "volcengine"].includes(mode)) throw new Error("\u672A\u77E5\u63A5\u5165\u65B9\u5F0F");
  const inactive = mode === "volcengine" ? ["metaonticApiKey", "apiKey", "keyOrigin", "baseUrl", "submitPath", "queryPath", "registerEmail", "deviceId", "deviceSecret", "registerApi", "registerToken"] : mode === "metaontic" ? ["volcengineApiKey", "apiKey", "keyOrigin", "registerEmail", "deviceId", "deviceSecret", "registerApi", "registerToken"] : ["volcengineApiKey", "metaonticApiKey"];
  if (ref(config, "connectionMode", "service") === "volcengine" && mode !== "volcengine") {
    for (const key of ["baseUrl", "submitPath", "queryPath"]) if (patch[key] === void 0) patch[key] = "";
  }
  for (const key of inactive) patch[key] = "";
  return { ...patch, ...connectionDefaults({ ...Object.fromEntries(Object.keys(config || {}).map((key) => [key, ref(config, key, void 0)])), ...patch }) };
}
async function writeProfileConfig(settings, config, patch) {
  const entryId = String(ref(config, "entryId", "metaontic-video")).trim();
  const descriptors = settings.describe({ redactSecrets: true });
  const entry = descriptors.find((item) => item.ns === entryId);
  if (!entry) {
    throw new Error(
      `profile patch \u91CC\u6CA1\u6709\u53EF\u7F16\u8F91\u7684 ${entryId} \u6761\u76EE\uFF0C\u65E0\u6CD5\u5199\u56DE\u914D\u7F6E\u3002\u8BF7\u5148\u5728 profile \u7684 cordis.patch.yml \u91CC\u52A0\u4E00\u6761\u8986\u76D6\u9879\uFF1A
- id: ${entryId}
  name: 'metaontic-video'
  config: { apiKey: 'sk-...', baseUrl: '...', model: '...' }
\uFF08\u4E5F\u53EF\u4EE5\u8BA9 Agent \u4EE3\u5199\u8FD9\u4E00\u6761\u3002\uFF09`
    );
  }
  await settings.update(entryId, patch, entry.revision);
  return entryId;
}
function configTool(config, settings) {
  return {
    name: "video_config",
    description: "\u8BFB\u53D6\u6216\u4FEE\u6539 MetaOnticVideo \u63D2\u4EF6\u81EA\u5DF1\u7684\u914D\u7F6E\uFF08baseUrl\u3001submitPath\u3001queryPath\u3001model\u3001imageModel\u3001duration\u3001singleMaxSeconds\u3001ratio\u3001generateAudio\u3001watermark\u3001extraParams\u3001pollIntervalMs\u3001maxWaitMs\u3001mergeMode\u3001outputDir\u3001resumeLockStaleMinutes\u3001ffmpegBinary\u3001ffprobeBinary\u3001registerEmail\u3001registerApi\u3001estimateGroupRatio\uFF09\u3002apiKey \u53EA\u80FD\u7531\u8BBE\u7F6E\u9875\u300C\u767B\u5F55\u300D\u65F6\u670D\u52A1\u7AEF\u4E0B\u53D1\uFF0C\u8FD9\u91CC\u53EA\u80FD\u770B\u3001\u4E0D\u80FD\u6539\uFF1B\u4EC5\u670D\u52A1\u7AEF\u6A21\u5F0F\u6362 Key \u9700\u8981\u767B\u5F55\uFF1BMetaOntic AI \u4F7F\u7528 metaonticApiKey\uFF0C\u706B\u5C71\u76F4\u8FDE\u4F7F\u7528 volcengineApiKey\uFF0C\u53EF\u624B\u52A8\u914D\u7F6E\u3002\u6539\u52A8\u5199\u8FDB profile \u7684 cordis.patch.yml\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u540E\u751F\u6548\u3002\u7528\u6237\u8BF4\u300C\u628A\u4E2D\u8F6C\u7AD9\u5730\u5740/\u6A21\u578B/\u65F6\u957F\u6539\u6210 X\u300D\u65F6\u7528 action=set\uFF0C\u770B\u5F53\u524D\u503C\u7528 action=get\uFF1Bduration \u662F\u6BCF\u6BB5\u65B0\u589E\u79D2\u6570\u4E0A\u9650\uFF084 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09\uFF0C\u9ED8\u8BA4\u6309\u6A21\u578B\u4E0A\u9650\u3001\u6BB5\u6570\u6700\u5C11\uFF09\uFF0CsingleMaxSeconds \u4E3A\u517C\u5BB9\u65E7\u914D\u7F6E\u4FDD\u7559\uFF0C\u76F4\u51FA\u4E0A\u9650\u7531\u6A21\u578B\u6620\u5C04\u3002",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "set"],
          description: "get=\u67E5\u770B\u5F53\u524D\u914D\u7F6E\uFF1Bset=\u4FEE\u6539\u914D\u7F6E\uFF08\u81F3\u5C11\u7ED9\u4E00\u4E2A\u8981\u6539\u7684\u5B57\u6BB5\uFF09\u3002"
        },
        connectionMode: { type: "string", enum: ["service", "metaontic", "volcengine"], description: "A \u670D\u52A1\u7AEF / B MetaOntic AI / C \u706B\u5C71\u76F4\u8FDE" },
        metaonticApiKey: { type: "string", description: "MetaOntic AI \u624B\u52A8 API Key\uFF0C\u65E0\u9700\u767B\u5F55" },
        volcengineApiKey: { type: "string", description: "C \u6A21\u5F0F\u706B\u5C71 API Key" },
        baseUrl: { type: "string", description: "\u57FA\u7840\u5730\u5740\uFF0C\u5373\u4E2D\u8F6C\u7AD9\u7AD9\u5740\uFF0C\u4F8B\u5982 https://ai.bileego.com\u3002" },
        registerEmail: { type: "string", description: "\u9886 Key \u7528\u7684\u90AE\u7BB1\uFF08\u8D26\u53F7\uFF09\uFF1B\u6CE8\u518C\u8981\u90AE\u7BB1\u9A8C\u8BC1\u7801\uFF0C\u4E00\u4E2A\u90AE\u7BB1\u53EA\u53D1\u4E00\u628A\u3002" },
        registerApi: { type: "string", description: "\u63D2\u4EF6\u670D\u52A1\u5730\u5740\uFF08\u9886 Key / \u67E5\u989D\u5EA6 / \u4F7F\u7528\u8BB0\u5F55\uFF09\uFF1B\u7559\u7A7A\u7528\u5185\u7F6E\u57DF\u540D\u3002" },
        estimateGroupRatio: { type: "number", description: "\u9884\u4F30\u8D39\u7528\u7528\u7684\u5206\u7EC4\u6298\u6263\uFF08\u4E2D\u8F6C\u7AD9 group_ratio\uFF1A\u9ED8\u8BA4 0.8\uFF09\u3002" },
        submitPath: { type: "string", description: "\u521B\u5EFA\u4EFB\u52A1\u8DEF\u5F84\uFF0C\u4F8B\u5982 /doubao/api/v3/contents/generations/tasks\u3002" },
        queryPath: { type: "string", description: "\u67E5\u8BE2\u4EFB\u52A1\u8DEF\u5F84\uFF0C{task_id} \u4F1A\u88AB\u66FF\u6362\u3002" },
        imageUseVideoKey: { type: "boolean", description: "\u4EC5 B \u65B9\u5F0F\u53EF\u9009\u62E9\u662F\u5426\u5171\u7528 Key\uFF0C\u9ED8\u8BA4 true\uFF1BA \u56FA\u5B9A\u5171\u7528\u767B\u5F55\u4E0B\u53D1\u7684 Key" },
        imageApiKey: { type: "string", description: "\u5173\u95ED\u5171\u7528\u65F6\u5FC5\u987B\u586B\u5199\u7684\u56FE\u7247\u6A21\u578B Key\uFF0C\u5730\u5740\u4ECD\u6CBF\u7528\u5F53\u524D A/B \u8FDE\u63A5" },
        imageModel: { type: "string", enum: ["doubao-seedream-5-0-260128", "doubao-seedream-5-0-pro-260628"], description: "A/B \u771F\u4EBA\u53C2\u8003\u56FE\u975E\u771F\u4EBA\u5316\u6A21\u578B" },
        model: { type: "string", description: "\u6A21\u578B ID\uFF0C\u4F8B\u5982 doubao-seedance-2-0-mini-260615\u3002" },
        duration: { type: "integer", minimum: 4, maximum: modelMaxSeconds(config), description: "\u6BCF\u6BB5\u65B0\u589E\u79D2\u6570\u4E0A\u9650\uFF084 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09 \u7684\u6574\u6570\uFF0C\u9ED8\u8BA4\u6309\u6A21\u578B\u4E0A\u9650\u3001\u6BB5\u6570\u6700\u5C11\uFF09\u3002" },
        ratio: {
          type: "string",
          enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
          description: "\u753B\u9762\u6BD4\u4F8B\u3002"
        },
        generateAudio: { type: "boolean", description: "\u662F\u5426\u751F\u6210\u97F3\u9891\u3002" },
        watermark: { type: "boolean", description: "\u662F\u5426\u52A0\u6C34\u5370\u3002" },
        extraParams: { type: "string", description: "\u989D\u5916\u8BF7\u6C42\u53C2\u6570\uFF08JSON \u5BF9\u8C61\u5B57\u7B26\u4E32\uFF09\u3002" },
        pollIntervalMs: { type: "integer", minimum: 1e3, description: "\u8F6E\u8BE2\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09\u3002" },
        maxWaitMs: { type: "integer", minimum: 1e3, description: "\u5355\u6B21\u8C03\u7528\u6700\u957F\u7B49\u5F85\uFF08\u6BEB\u79D2\uFF09\u3002" },
        pollErrorRetries: {
          type: "integer",
          minimum: 1,
          maximum: 60,
          description: "\u8F6E\u8BE2\u300C\u67E5\u8BE2\u5931\u8D25\u300D\u7684\u5BB9\u5FCD\u6B21\u6570\uFF08\u9ED8\u8BA4 5\uFF09\uFF1A\u8FDE\u7EED\u5931\u8D25\u8FD9\u4E48\u591A\u6B21\u624D\u653E\u5F03\u7B49\u5F85\uFF1B\u653E\u5F03\u65F6\u4EFB\u52A1 ID \u4ECD\u4FDD\u7559\uFF0C\u53EF\u7528 video_status \u8865\u67E5\u3002"
        },
        singleMaxSeconds: {
          type: "integer",
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description: "\u5355\u6B21\u76F4\u51FA\u4E0A\u9650\uFF08\u79D2\uFF09\uFF1A\u4E0D\u8D85\u8FC7\u5B83\u4E00\u6B21\u751F\u6210\uFF0C\u8D85\u8FC7\u5B83\u624D\u5206\u6BB5\u5EF6\u957F\u3002"
        },
        seamTrimSeconds: { type: "string", description: "\u9884\u89C8\u786E\u8BA4\u540E\u88C1\u526A\u5404\u63A5\u7F1D\uFF1A\u5982 0.5,0 \u8868\u793A\u4EC5\u88C1\u7B2C2\u6BB5\u5F00\u59340.5\u79D2\uFF1B\u7559\u7A7A\u65F62.0\u88C1\u524D\u6BB5\u5C3E6\u5E27\u548C\u540E\u6BB5\u59341\u5E27\uFF0C2.5\u4E0D\u88C1\uFF1B\u586B0\u5173\u95ED\u3002\u97F3\u89C6\u9891\u540C\u6B65\u88C1\u526A\uFF0C\u5B9E\u9645\u65F6\u957F\u7F29\u77ED\u3002" },
        mergeMode: {
          type: "string",
          enum: ["seamless", "copy", "reencode"],
          description: "\u5408\u5E76\u65B9\u5F0F\uFF1Acopy=\u76F4\u63A5\u65E0\u635F\u62FC\u63A5\uFF08\u9ED8\u8BA4\uFF0C\u4E0D\u505A\u753B\u9762\u53E0\u5316\uFF09\uFF1Breencode=\u7EDF\u4E00\u91CD\u7F16\u7801\u540E\u76F4\u63A5\u62FC\u63A5\uFF1B\u65E7\u914D\u7F6E seamless \u6309 copy \u5904\u7406\u3002"
        },
        outputDir: { type: "string", description: "\u6210\u7247\u8F93\u51FA\u76EE\u5F55\uFF1B\u7559\u7A7A\u7528\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/\u3002" },
        resumeLockStaleMinutes: {
          type: "number",
          minimum: 0,
          description: "\u6682\u505C\u76EE\u5F55\u7684\u7EED\u505A\u9501\u591A\u4E45\u7B97\u8FC7\u671F\uFF08\u5206\u949F\uFF0C\u9ED8\u8BA4 60\uFF0C0=\u6C38\u4E0D\u8FC7\u671F\uFF09\u3002"
        },
        ffmpegBinary: { type: "string", description: "ffmpeg \u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u3002" },
        ffprobeBinary: { type: "string", description: "ffprobe \u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u3002" }
      },
      required: ["action"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          action: { type: "string" },
          entryId: { type: "string" },
          editable: { type: "boolean" },
          patchPath: { type: "string" },
          stored: { type: "object" },
          effective: { type: "object" },
          patch: { type: "object" },
          error: { type: "string" }
        }
      },
      render(_args, value) {
        const { action, stored, effective, entryId, patchPath, patch, error } = value || {};
        if (error) return [{ type: "text", text: error }];
        const lines = [
          action === "set" ? `\u5DF2\u5199\u5165 profile patch\uFF08\u6761\u76EE ${entryId}\uFF09` : "\u5F53\u524D\u914D\u7F6E\uFF1A",
          ...Object.entries(stored || {}).filter(([, field]) => field !== void 0 && field !== "").map(([key, field]) => `  ${key}: ${typeof field === "object" ? JSON.stringify(field) : field}`),
          `\u751F\u6548\u503C\uFF1AbaseUrl=${effective?.baseUrl} model=${effective?.model}`,
          `  submitPath=${effective?.submitPath}`,
          `  apiKey \u6765\u6E90\uFF1A${{
            register: "\u670D\u52A1\u7AEF\u4E0B\u53D1\uFF08\u767B\u5F55\u5199\u5165\uFF09",
            unverified: "\u975E\u670D\u52A1\u7AEF\u4E0B\u53D1\u2014\u2014\u8C03\u7528\u4F1A\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u5230\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D",
            missing: "\u672A\u914D\u7F6E\u2014\u2014\u8BF7\u5230\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D"
          }[effective?.apiKeySource] || effective?.apiKeySource}`,
          patchPath ? `\u914D\u7F6E\u6587\u4EF6\uFF1A${patchPath}` : "",
          patch && Object.keys(patch).length ? "\u6539\u52A8\u4F1A\u5728\u5BBF\u4E3B\u91CD\u8F7D\u914D\u7F6E\u540E\u751F\u6548\u3002" : ""
        ].filter(Boolean);
        return [{ type: "text", text: lines.join("\n") }];
      }
    },
    timeoutMs: 3e4,
    isConcurrencySafe() {
      return false;
    },
    async execute(args) {
      const action = args?.action;
      const view = configView(config);
      const patchPath = settings?.documentPath;
      if (action === "get") {
        return { action, ...view, editable: Boolean(settings), patchPath };
      }
      if (action !== "set") {
        throw new Error("action \u53EA\u80FD\u662F get \u6216 set\u3002");
      }
      if (args?.mode !== void 0) throw new Error("\u7EED\u62CD\u65B9\u5F0F\u7531\u5DF2\u5BA1\u6838\u811A\u672C\u51B3\u5B9A\uFF0C\u8BF7\u5728 video_generate/video_extend \u7684\u672C\u6B21\u53C2\u6570\u6216\u8FC7\u6E21\u63CF\u8FF0\u4E2D\u6307\u5B9A\uFF0C\u4E0D\u518D\u4F5C\u4E3A\u63D2\u4EF6\u8BBE\u7F6E\u4FDD\u5B58\u3002");
      const readonly = Object.keys(args || {}).filter((key) => READ_ONLY_CONFIG_FIELDS.has(key));
      if (readonly.length) {
        throw new Error(
          `${readonly.join("\u3001")} \u7531\u670D\u52A1\u7AEF\u5728\u300C\u767B\u5F55\u300D\u65F6\u4E0B\u53D1\uFF0C\u4E0D\u80FD\u624B\u52A8\u6539\uFF1B\u8981\u6362 Key \u8BF7\u5728\u300C\u63D2\u4EF6 \u2192 \u5DF2\u5B89\u88C5\u63D2\u4EF6 \u2192 MetaOnticVideo \u2192 \u67E5\u770B\u300D\u70B9\u300C\u767B\u5F55\u300D\u91CD\u65B0\u9886\u53D6\u3002`
        );
      }
      let patch = {};
      for (const key of CONFIG_FIELDS) {
        if (args?.[key] !== void 0 && !READ_ONLY_CONFIG_FIELDS.has(key)) patch[key] = args[key];
      }
      if (!Object.keys(patch).length) {
        throw new Error("set \u9700\u8981\u81F3\u5C11\u4E00\u4E2A\u8981\u4FEE\u6539\u7684\u5B57\u6BB5\uFF08\u5982 baseUrl\u3001model\u3001duration\uFF09\u3002");
      }
      if (!settings) {
        throw new Error(
          "\u5BBF\u4E3B\u6CA1\u6709\u63D0\u4F9B settings \u670D\u52A1\uFF0C\u65E0\u6CD5\u5199\u56DE\u914D\u7F6E\u3002\u8BF7\u624B\u52A8\u7F16\u8F91 profile \u7684 cordis.patch.yml \u91CC metaontic-video \u90A3\u4E00\u6761\u7684 config\uFF08\u89C1\u63D2\u4EF6 README\uFF09\u3002"
        );
      }
      patch = normalizeConnectionPatch(config, patch);
      const entryId = await writeProfileConfig(settings, config, patch);
      const updated = {};
      for (const key of CONFIG_FIELDS) updated[key] = patch[key] !== void 0 ? patch[key] : ref(config, key, void 0);
      return { action, entryId, patchPath, patch: maskSecrets(patch), ...configView(updated) };
    }
  };
}

// src/prompts/guidance.ts
init_connection();
init_config();
function buildPromptGuidance(config) {
  const singleMax = resolveSingleMax(config);
  const segmentSeconds = resolveSegmentSeconds(config);
  return [
    "\xB7 \u5206\u955C\u5C55\u793A\u68C0\u67E5\uFF1A\u5BA1\u6838\u63D0\u95EE\u524D\u5C06\u6838\u5BF9\u672C\u8F6Epresent\u767B\u8BB0\u548C\u5176\u540E\u72EC\u7ACBassistant\u6B63\u6587\u4E2D\u7684\u56FE\u7247\u8BED\u6CD5\uFF1B\u4EC5reasoning\u3001\u5DE5\u5177\u770B\u56FE\u6216present\u6210\u529F\u4F1A\u88AB\u62E6\u622A\u3002\u5148\u5B9E\u9645\u53D1\u9001\u56FE\u548C\u539F\u56FE\u94FE\u63A5\uFF0C\u518D\u5355\u72EC\u63D0\u5BA1\u6838\u95EE\u9898\uFF1B\u4E0D\u8981\u628A\u56FE\u7247\u63CF\u8FF0\u5F53\u56FE\u7247\u3002",
    "\xB7 \u5206\u955C\u56FE\u5FC5\u987B\u5B9E\u9645\u53EF\u89C1\uFF1A\u5148\u786E\u8BA4\u5F53\u524D\u9879\u76EE/\u7248\u672C\u7684SVG\u6216PNG\u6587\u4EF6\u771F\u5B9E\u5B58\u5728\uFF0C\u518D\u8C03\u7528present\u767B\u8BB0\u5E76\u7B49\u5F85\u6210\u529F\uFF0C\u7136\u540E\u5728\u7528\u6237\u53EF\u89C1\u6B63\u6587\u8F93\u51FAMarkdown\u5185\u5D4C\u56FE\u7247\uFF08\u611F\u53F9\u53F7+\u56FE\u7247\u6807\u7B7E+\u5C16\u62EC\u53F7\u5305\u88F9\u7684\u7EDD\u5BF9\u8DEF\u5F84\uFF09\uFF0C\u540C\u65F6\u7ED9\u51FA\u6253\u5F00\u539F\u56FE\u7684\u6587\u4EF6\u94FE\u63A5\u3002present\u53EA\u767B\u8BB0\u4EA4\u4ED8\uFF0C\u4E0D\u7B49\u4E8E\u6B63\u6587\u5DF2\u7ECF\u6E32\u67D3\uFF1Bread_image\u7B49\u6A21\u578B\u770B\u56FE\u5DE5\u5177\u6210\u529F\u4E5F\u4E0D\u7B49\u4E8E\u7528\u6237\u770B\u5230\u56FE\u3002\u4E0D\u80FD\u53EA\u8BF4\u5DF2\u753B\u597D\u3001\u53EA\u7ED9\u76EE\u5F55\u6216\u5F39\u5BA1\u6838\u7A97\u3002SVG/HTML\u4E0D\u80FD\u5185\u5D4C\u65F6\u7528\u5DF2\u6709\u672C\u5730\u5DE5\u5177\u5BFC\u51FAPNG\uFF0C\u4E0D\u80FD\u4E3A\u6B64\u64C5\u81EA\u8C03\u7528\u4ED8\u8D39\u51FA\u56FE\u6216\u5B89\u88C5\u8F6F\u4EF6\uFF1B\u786E\u5B9E\u65E0\u6CD5\u5185\u5D4C\u65F6\u660E\u786E\u8BF4\u660E\u5E76\u63D0\u4F9B\u5B9E\u9645\u53EF\u6253\u5F00\u6587\u4EF6\uFF0C\u4E0D\u58F0\u79F0\u5DF2\u5C55\u793A\u6210\u529F\u3002\u5148\u53D1\u51FA\u5305\u542B\u56FE\u7247/\u6253\u5F00\u5165\u53E3\u7684\u6B63\u6587\uFF0C\u518D\u53D1\u811A\u672C\u5BA1\u6838\u63D0\u95EE\uFF0C\u7981\u6B62\u4E0E\u5C55\u793A\u5DE5\u5177\u5E76\u884C\u3002\u7528\u6237\u8BF4\u6CA1\u770B\u5230\u56FE\u65F6\u5148\u8865\u5C55\u793A\u540C\u4E00\u7248\u56FE\uFF0C\u4E0D\u76F4\u63A5\u7EE7\u7EED\u5BA1\u6838\u6216\u91CD\u65B0\u751F\u6210\u89C6\u9891\u3002",
    "\xB7 \u7EED\u62CD\u65B9\u5F0F\u7531\u672C\u7248\u5DF2\u5BA1\u6838\u811A\u672C\u51B3\u5B9A\uFF0C\u4E0D\u5728\u63D2\u4EF6\u8BBE\u7F6E\u9875\u914D\u7F6E\uFF0C\u4E0D\u7528video_config\u4FDD\u5B58\u5168\u5C40mode\u3002\u6BCF\u6BB5\u660E\u786E\u8FDE\u7EED\u955C\u5934\u8FD8\u662F\u6709\u52A8\u673A\u7684\u666F\u522B\u5207\u6362\uFF0C\u5E76\u5199\u5165\u8FC7\u6E21\u63CF\u8FF0\uFF1B\u5B9E\u9645\u8C03\u7528\u4F20\u76F8\u5E94mode\u6216transitionDescription\u3002\u672A\u6307\u5B9A\u65F6\u7528\u8FDE\u7EED\u7EED\u62CD\uFF0C\u65E7\u914D\u7F6Emode\u4E0D\u5F71\u54CD\u65B0\u4EFB\u52A1\uFF1Bresume\u4FDD\u7559\u8BB0\u5F55\u91CC\u7684mode\u4E0E\u8FC7\u6E21\uFF0C\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u539F\u8BF7\u6C42\u4E0D\u6539\u3002",
    "\xB7 \u5B98\u65B9\u63D0\u793A\u8BCD\u7EC6\u5219\uFF1A\u5148\u5B9A\u4E49\u4EBA\u7269\u3001\u9053\u5177\u3001\u573A\u666F\u7B49\u4E3B\u4F53\uFF0C\u4F7F\u75282\u20133\u4E2A\u7A33\u5B9A\u53EF\u8BC6\u522B\u7279\u5F81\u4E0E\u7D20\u6750\u7F16\u53F7\u5EFA\u7ACB\u7ED1\u5B9A\uFF0C\u540E\u6587\u56FA\u5B9A\u4F7F\u7528\u540C\u4E00\u6807\u7B7E\u3002\u6BCF\u4E2A\u751F\u6210\u6BB5\u5185\u90E8\u6309\u955C\u59341/\u955C\u59342/\u955C\u59343\u7684\u4E8B\u4EF6\u987A\u5E8F\u5199\u8C01\u3001\u5728\u54EA\u3001\u505A\u4EC0\u4E48\u3001\u955C\u5934\u600E\u4E48\u52A8\u53CA\u58F0\u97F3\uFF0C\u4E0D\u5F3A\u884C\u51D1\u6EE1\u4E09\u4E2A\u955C\u5934\uFF1B\u5206\u955C\u7F16\u53F7\u4E0D\u589E\u52A0\u4ED8\u8D39\u751F\u6210\u6B21\u6570\uFF0C2.0\u4E0D\u5F3A\u5236\u9010\u955C\u79D2\u70B9\u3002\u52A8\u4F5C\u5199\u5177\u4F53\u90E8\u4F4D\u3001\u5E45\u5EA6\u3001\u901F\u5EA6\u3001\u529B\u5EA6\u548C\u60EF\u6027\u627F\u63A5\uFF0C\u7528\u53EF\u89C1\u8868\u60C5/\u59FF\u6001\u8868\u73B0\u60C5\u7EEA\uFF1B\u4E00\u822C\u4F18\u5148\u4F4E\u7F13\u8FDE\u7EED\u5C0F\u52A8\u4F5C\uFF0C\u52A8\u4F5C\u620F\u4E0E\u7528\u6237\u660E\u786E\u5267\u60C5\u4F18\u5148\uFF0C\u4E0D\u64C5\u81EA\u6539\u5199\u3002\u5C06\u666F\u522B\uFF08\u8FDC\u666F/\u5168\u666F/\u4E2D\u666F/\u8FD1\u666F/\u7279\u5199\uFF09\u3001\u89C6\u89D2\uFF08\u4FEF\u62CD/\u4EF0\u62CD/\u822A\u62CD/\u5FAE\u8DDD\u7B49\uFF09\u3001\u8FD0\u955C\uFF08\u63A8/\u62C9/\u6447/\u79FB/\u73AF\u7ED5/\u8DDF\u968F/\u5347\u964D/\u53D8\u7126\uFF09\u5206\u522B\u5199\u6E05\uFF0C\u4E00\u4E2A\u955C\u5934\u5C3D\u91CF\u53EA\u5B89\u6392\u4E00\u79CD\u8FD0\u955C\uFF0C\u907F\u514D\u4E92\u76F8\u77DB\u76FE\u3002\u753B\u8D28\u63CF\u8FF0\u5199\u7EB9\u7406\u3001\u8272\u5F69\u548C\u5149\u5F71\u8D28\u611F\uFF0C\u4E0D\u80FD\u4EE3\u66FF\u7528\u6237\u786E\u8BA4\u7684480P/720P\u53C2\u6570\uFF1B\u89C6\u89C9\u98CE\u683C\u4E0E\u7528\u6237\u65B9\u6848\u4E00\u81F4\uFF0C\u9010\u6BB5\u4FDD\u6301\u7EDF\u4E00\u3002\u7EA6\u675F\u8BCD\u6309\u9700\u6C42\u660E\u786E\u65E0\u5B57\u5E55\u3001\u65E0\u65B0\u589ELogo\u6216\u6C34\u5370\u3001\u4E3B\u4F53\u7A33\u5B9A\u4E0D\u53D8\u5F62\u4E0E\u65E0\u95EA\u70C1\uFF0C\u4F46\u4E0D\u5F97\u8986\u76D6\u7528\u6237\u660E\u786E\u8981\u6C42\u7684\u5B57\u5E55\u3001\u54C1\u724C\u6807\u8BC6\u6216\u6C34\u5370\u3002",
    "\xB7 \u811A\u672C\u4E0E\u9010\u6BB5\u63D0\u793A\u8BCD\u91C7\u7528\u5B98\u65B9\u8FDB\u9636\u516C\u5F0F\uFF1A\u7CBE\u51C6\u4E3B\u4F53\u3001\u52A8\u4F5C\u7EC6\u8282\u3001\u573A\u666F\u73AF\u5883\u3001\u5149\u5F71\u8272\u8C03\u3001\u955C\u5934\u8FD0\u955C\u3001\u89C6\u89C9\u98CE\u683C\u3001\u753B\u8D28\u3001\u7EA6\u675F\u6761\u4EF6\u3002\u6BCF\u4E2A\u7EED\u62CD\u6BB5\u5728\u811A\u672C\u5206\u6BB5\u8868\u4E2D\u53E6\u5199\u660E\u786E\u7684\u8FC7\u6E21\u753B\u9762\u63CF\u8FF0\uFF1A\u4E0A\u4E00\u6BB5\u63A5\u7F1D\u72B6\u6001\u2192\u672C\u6BB5\u8D77\u59CB\u52A8\u4F5C\u4E0E\u955C\u5934\u2192\u58F0\u97F3\u4EA4\u63A5\uFF1B\u540C\u666F\u522B\u8FDE\u7EED\u6216\u5207\u4E2D\u666F/\u8FD1\u666F\u7531\u5267\u60C5\u51B3\u5B9A\uFF0C\u4E0D\u56E0\u5206\u6BB5\u81EA\u52A8\u6362\u573A\u666F\u3002\u8BE5\u63CF\u8FF0\u4E0E\u5B8C\u6574\u811A\u672C\u3001\u793A\u610F\u56FE\u4E00\u540C\u5C55\u793A\u5BA1\u6838\uFF0C\u4FEE\u6539\u540E\u91CD\u65B0\u5BA1\u6838\u3002\u6267\u884C\u65F6\u5C06\u8BE5\u6BB5\u5DF2\u5BA1\u6838\u63CF\u8FF0\u5199\u5165 segmentPrompts \u5BF9\u5E94\u6761\u76EE\u7684\u5355\u884C\u3010\u8FC7\u6E21\u753B\u9762\u3011\uFF0C\u6216 video_extend.transitionDescription\uFF1B\u76F4\u63A5\u7528\u201C\u89C6\u98911\u201D\u6307\u4EE3\u7D20\u6750\u5E76\u4F7F\u7528\u5411\u524D/\u5411\u540E\u5EF6\u957F\u89C6\u98911\uFF0C\u4E0D\u5199\u53C2\u8003\u89C6\u98911\u3002\u8F68\u9053\u8865\u5168\u591A\u4E2A\u65E2\u6709\u89C6\u9891\u7684\u5B98\u65B9\u53E5\u5F0F\u4EC5\u4F5C\u8BBE\u8BA1\u53C2\u8003\uFF0C\u4E0D\u5047\u79F0\u5F53\u524D\u5DE5\u5177\u5DF2\u652F\u6301\u591A\u89C6\u9891\u8F93\u5165\uFF0C\u4E5F\u4E0D\u4E3A\u8F6C\u573A\u64C5\u81EA\u589E\u52A0\u4ED8\u8D39\u4EFB\u52A1\u3002\u4FDD\u7559\u4EBA\u7269/\u58F0\u97F3/\u98CE\u683C\u8FDE\u7EED\u6027\uFF0C\u4E0D\u4FDD\u8BC1\u5B8C\u5168\u6D88\u9664\u63A5\u7F1D\u8DF3\u53D8\u3002",
    "\xB7 \u7EED\u62CD\u4F30\u4EF7\u53E3\u5F84\uFF1A\u4F30\u4EF7\u6309\u771F\u5B9E\u8F93\u5165\u533A\u5206\u6863\u4F4D\uFF1A\u9996\u6BB5\u751F\u6210\u65E0\u89C6\u9891\u8F93\u5165\uFF08\u53C2\u8003\u56FE/\u9996\u5C3E\u5E27\u4ECD\u4E3A\u65E0\u89C6\u9891\u8F93\u5165\uFF09\uFF0C\u6BCF\u4E2A\u7EED\u62CD\u6BB5\u6709\u89C6\u9891\u8F93\u5165\uFF0C\u7528\u4E0A\u4E00\u6BB5\u5B8C\u6574\u89C6\u9891\u65F6\u957F\u52A0\u672C\u6BB5\u8F93\u51FA\u65F6\u957F\u8BA1token\uFF0C\u5207\u6362\u5230\u542B\u89C6\u9891\u8F93\u5165\u5355\u4EF7\uFF1B\u4E0D\u628A\u7D2F\u8BA1\u6210\u7247\u65F6\u957F\u5F53\u4E0A\u4E00\u6BB5\u8F93\u5165\u3002\u811A\u672C\u8D39\u7528\u9884\u4F30\u9010\u6BB5\u5217\u6863\u4F4D\u3001\u8F93\u5165/\u8F93\u51FA\u65F6\u957F\u3001\u5355\u4EF7\u4E0E\u91D1\u989D\u518D\u5408\u8BA1\uFF1B\u5236\u4F5C\u786E\u8BA4\u548C\u6062\u590D\u9884\u68C0\u540C\u53E3\u5F84\uFF0C\u5916\u90E8\u89C6\u9891\u65F6\u957F\u4E0D\u660E\u5C31\u660E\u786E\u65E0\u6CD5\u53EF\u9760\u4F30\u4EF7\uFF0C\u4E0D\u6309\u7EAF\u751F\u6210\u8D39\u7528\u515C\u5E95\uFF0C\u4E0D\u8C03\u7528\u4ED8\u8D39\u4EFB\u52A1\u8BD5\u7B97\u3002",
    "\xB7 \u89D2\u8272\u56FE\u9009\u62E9\u5F3A\u5236\u68C0\u67E5\uFF1A\u89D2\u8272\u56FE\u9009\u62E9\u5FC5\u987B\u7531\u63D0\u4EA4\u524D\u4EE3\u7801\u6821\u9A8C\uFF1A\u65B0\u5EFA\u65E0\u56FEvideo_generate\u8C03\u7528\u901A\u8FC7userQuestions\u670D\u52A1\u8BE2\u95EE\u4E24\u9879\u9009\u62E9\uFF0C\u4E0D\u80FD\u4EC5\u9760\u52A9\u624B\u63D0\u793A\u8BCD\u3002\u76F4\u63A5\u6587\u751F\u7684\u660E\u786E\u9009\u62E9\u624D\u8FDB\u5165\u539F\u89C6\u9891\u5236\u4F5C\u5BA1\u6279\uFF1B\u5148\u751F\u6210\u89D2\u8272\u56FE\u5219\u505C\u6B62\u8BE5\u6B21\u89C6\u9891\u63D0\u4EA4\u3001\u63D0\u793A\u5148\u51FA\u56FE\u548C\u5BA1\u6838\uFF0C\u5E26\u56FE\u540E\u518D\u5236\u4F5C\u3002\u672A\u7B54/\u53D6\u6D88/pending/\u4EA4\u4E92\u4E0D\u53EF\u7528/\u8BB0\u5F55\u5931\u8D25\u5747\u505C\u6B62\uFF0C\u4E0D\u9ED8\u8BA4\u6587\u751F\u3002\u6309\u4F1A\u8BDD\u4E0E\u5F53\u524D\u811A\u672C\u89C4\u683C\u8BB0\u5F55\u660E\u786E\u9009\u62E9\uFF0C\u91CD\u8BD5\u76F8\u540C\u4EFB\u52A1\u4E0D\u91CD\u590D\u95EE\uFF1B\u65B0\u9879\u76EE\u91CD\u65B0\u9009\u62E9\u3002\u5DF2\u6709\u56FE\u7247\u6216resume\u7EED\u505A\u4E0D\u91CD\u95EE\u3001\u4E0D\u6539\u53D8\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u3002\u52A9\u624B\u4E0D\u8981\u53E6\u884C\u91CD\u590D\u521B\u5EFA\u540C\u4E00\u89D2\u8272\u56FE\u9009\u62E9\u95EE\u9898\uFF1B\u82E5\u63D0\u4EA4\u524D\u4EA4\u4E92\u88AB\u62E6\u622A\uFF0C\u6309\u8FD4\u56DE\u7684\u771F\u5B9E\u7528\u6237\u9009\u62E9\u63A8\u8FDB\u3002",
    "\xB7 \u7EAF\u6587\u751F\u89D2\u8272\u56FE\uFF1A\u7EAF\u6587\u751F\u89C6\u9891\u89D2\u8272\u56FE\u9009\u62E9\uFF1A\u6709\u9700\u8981\u56FA\u5B9A\u5916\u5F62\u7684\u4EBA\u7269/\u4E3B\u4F53\u4E14\u672A\u63D0\u4F9B\u56FE\u7247\u65F6\uFF0C\u5728\u51C6\u5907\u4EBA\u7269\u4E0E\u98CE\u683C\u540E\u3001\u6700\u7EC8\u811A\u672C\u5BA1\u6838\u4E0E\u89C6\u9891\u5236\u4F5C\u524D\uFF0C\u9009\u62E9\u7531\u63D2\u4EF6\u63D0\u4EA4\u524D\u7684\u5185\u7F6E\u4EA4\u4E92\u53D6\u5F97\uFF0C\u9009\u9879\u4E3A\u201C\u5148\u751F\u6210\u89D2\u8272\u56FE\uFF08\u5355\u72EC\u8BA1\u8D39\uFF09/\u76F4\u63A5\u6587\u751F\u89C6\u9891\u201D\uFF1B\u4E0D\u8981\u53E6\u884C\u91CD\u590D\u5F39\u540C\u4E00\u9009\u62E9\u3002\u672C\u6B21\u5DF2\u660E\u786E\u540C\u610F\u6216\u62D2\u7EDD\u5219\u8BB0\u5F55\u5230\u9879\u76EE\uFF0C\u4E0D\u91CD\u590D\u95EE\uFF1B\u672A\u7B54/\u53D6\u6D88/pending\u4E0D\u8868\u793A\u540C\u610F\uFF0C\u4E0D\u8C03\u7528\u56FE\u7247\u6216\u89C6\u9891\u3002\u7528\u6237\u62D2\u7EDD\u65F6\u4FDD\u7559\u7EAF\u6587\u751F\u65B9\u6848\uFF0C\u4E0D\u81EA\u52A8\u52A0\u56FE\uFF1B\u6CA1\u6709\u56FA\u5B9A\u4E3B\u4F53\u7684\u7A7A\u955C\u4E0D\u5F3A\u52A0\u89D2\u8272\u3002\u7528\u6237\u540C\u610F\u540E\u5148\u660E\u786E\u5916\u5F62\u4E0E\u975E\u771F\u4EBA\u98CE\u683C\uFF08\u5F71\u54CD\u539F\u5B9A\u5199\u5B9E\u98CE\u683C\u65F6\u987B\u8BF4\u660E\u5E76\u786E\u8BA4\uFF09\uFF0C\u8C03\u7528video_prepare_image(operation:create_character,prompt:\u89D2\u8272\u8BBE\u5B9A,style:\u5DF2\u786E\u8BA4\u98CE\u683C)\uFF0C\u9ED8\u8BA4\u4E00\u6B21\u4E00\u5F20\uFF0C\u4E0D\u9700\u8981\u539F\u56FE\u3002\u8BB0\u5F55taskId/imageUrl\uFF1B\u8D85\u65F6\u67E5\u8BE2\u539FtaskId\uFF0C\u4E0D\u91CD\u53D1\uFF1B\u5931\u8D25\u6216\u4E0D\u6EE1\u610F\u5148\u505C\u6B62\uFF0C\u91CD\u753B\u5148\u786E\u8BA4\u65B0\u589E\u8D39\u7528\u3002\u7ED3\u679C\u5728\u6B63\u6587\u5185\u5D4C\u5E76\u7ED9\u539F\u56FE\u94FE\u63A5\uFF0C\u5355\u72EC\u8BE2\u95EE\u201C\u8FD9\u5F20\u89D2\u8272\u56FE\u53EF\u4EE5\u7528\u4E8E\u63A5\u4E0B\u6765\u7684\u89C6\u9891\u5417\uFF1F\u201D\uFF0C\u5F85\u660E\u786E\u8BA4\u53EF\u540E\uFF0C\u5C06imageUrl\u540C\u65F6\u5199\u5165video_generate.referenceImages\u548CcharacterReferenceImages\u3002\u518D\u5C55\u793A\u542B\u89D2\u8272\u56FE\u3001\u811A\u672C\u3001\u5206\u955C\u4E0E\u8D39\u7528\u9884\u4F30\u7684\u672C\u7248\u6750\u6599\u5E76\u5BA1\u6838\uFF0C\u6700\u540E\u5355\u72EC\u786E\u8BA4\u89C6\u9891\u5236\u4F5C\u3002\u811A\u672C\u672B\u5C3E\u6CE8\u660E\u89D2\u8272\u56FE\u5355\u72EC\u8BA1\u8D39\u4E14\u4E0D\u5305\u542B\u5728\u89C6\u9891\u4F30\u4EF7\u4E2D\uFF1B\u9879\u76EE\u8BB0\u5F55\u89D2\u8272\u56FE\u9009\u62E9\u3001\u4EFB\u52A1\u53CA\u5BA1\u6838\u72B6\u6001\uFF0C\u6062\u590D\u540E\u4E0D\u91CD\u590D\u51FA\u56FE\u6216\u91CD\u590D\u95EE\u5DF2\u786E\u8BA4\u9009\u62E9\u3002\u706B\u5C71\u76F4\u8FDE\u65E0\u6B64\u56FE\u7247\u901A\u9053\u65F6\u5148\u8BF4\u660E\u9650\u5236\uFF0C\u53EF\u8BA9\u7528\u6237\u63D0\u4F9B\u89D2\u8272\u56FE\uFF0C\u4E0D\u8C0E\u79F0\u53EF\u4EE3\u753B\u3002",
    "\xB7 \u521D\u59CB\u89D2\u8272\u53C2\u8003\uFF1A\u6700\u521D\u89D2\u8272\u56FE\u6301\u7EED\u53C2\u8003\uFF1A\u6BCF\u6BB5\u7EED\u62CD\u643A\u5E26\u4E0A\u4E00\u6BB5\u89C6\u9891\u4E0E\u540C\u4E00\u5957\u6700\u521D\u5DF2\u5BA1\u6838\u89D2\u8272\u56FE\uFF1BcharacterReferenceImages\u53EF\u660E\u786E\u6307\u5B9A\uFF0C\u672A\u6307\u5B9A\u65F6\u6CBF\u7528\u9996\u6BB5referenceImages\u6216\u9996\u5E27\uFF0C\u9996\u5E27\u5728\u7EED\u62CD\u4E2D\u6539\u4F5Creference_image\u800C\u4E0D\u662Ffirst_frame\u3002\u89D2\u8272\u56FE\u5F52\u4E00\u5316\u540E\u968F\u65AD\u70B9\u4FDD\u5B58\uFF0C\u4E0D\u4F7F\u7528\u540E\u7EED\u6BB5\u843D\u622A\u56FE\u66FF\u4EE3\u521D\u59CB\u89D2\u8272\uFF0C\u4E0D\u81EA\u52A8\u91CD\u753B\uFF1B\u65E0\u521D\u59CB\u56FE\u7247\u65F6\u4ECD\u4E3A\u7EAF\u89C6\u9891\u7EED\u62CD\uFF0C\u4E0D\u865A\u6784\u89D2\u8272\u53C2\u8003\u56FE\u3002\u771F\u4EBA\u9650\u5236\u987B\u5148\u83B7\u8F6C\u6362\u540C\u610F\u3001\u5C55\u793A\u5BA1\u6838\uFF0C\u518D\u5355\u6B21\u89C6\u9891\u91CD\u8BD5\uFF1B\u6210\u529F\u540E\u590D\u7528\u5DF2\u5BA1\u6838\u8F6C\u6362\u56FE\u3002\u539F\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u4FDD\u7559originalBody\uFF0C\u4E0D\u56E0\u52A0\u56FE\u800C\u91CD\u65B0\u63D0\u4EA4\u3002",
    "\xB7 \u6D41\u7A0B\u8017\u65F6\u65E5\u5FD7\uFF1A\u9636\u6BB5\u8BA1\u65F6\uFF1A\u7F16\u5199\u811A\u672C\u524D\u7528video_stage(stage:script_design,action:start)\uFF0C\u5B8C\u6574\u811A\u672C\u4FDD\u5B58\u4E3Ascript.md\u540E\u8BE5\u6BB5\u7531\u63D2\u4EF6\u81EA\u52A8\u7ED3\u675F\uFF0C\u4E0D\u5FC5\u518D\u8C03finish\uFF08\u811A\u672C\u4E0D\u662F\u7528\u5199\u6587\u4EF6\u5DE5\u5177\u4FDD\u5B58\u65F6\u624D\u8865finish\u539FspanId\uFF09\uFF1B\u793A\u610F\u56FE\u7ED8\u5236\u7528storyboard_design\uFF0C\u5C55\u793A\u811A\u672C\u7528script_present\u3002\u5BA1\u6838/\u5236\u4F5C/\u53C2\u8003\u56FE/\u5206\u6BB5\u9884\u89C8\u7B49\u5F85\u5206\u522B\u7528script_review_wait\u3001production_confirm_wait\u3001reference_review_wait\u3001segment_review_wait\uFF0C\u5C55\u793A\u6210\u679C\u7528result_present\u3002\u7528\u6237\u56DE\u590D\u540E\u7ED3\u675F\u5BF9\u5E94\u7B49\u5F85\u6807\u8BB0\uFF1B\u4E0D\u5F97\u628A\u7B49\u5F85\u6DF7\u5165\u811A\u672C\u8BBE\u8BA1\u65F6\u95F4\uFF0C\u4E0D\u4E3A\u8BA1\u65F6\u91CD\u590D\u751F\u6210\u5185\u5BB9\u3002\u6807\u8BB0\u4EC5\u8BB0\u5F55\u8FB9\u754C\u5899\u949F\u8017\u65F6\uFF0C\u4E0D\u7B49\u4E8E\u6A21\u578B\u7EAF\u63A8\u7406\u65F6\u95F4\uFF1B\u6807\u8BB0\u4E0D\u53EF\u7528\u4ECD\u6B63\u5E38\u63A8\u8FDB\uFF0C\u4E0D\u731C\u8017\u65F6\u3002",
    "\xB7 \u5168\u90E8\u6587\u4EF6\u4EA4\u4ED8\uFF1A\u6240\u6709\u7528\u6237\u4EA4\u4ED8\u7684\u6587\u4EF6\uFF08\u811A\u672C\u3001\u5206\u955C\u793A\u610F\u56FE\u3001\u8F6C\u6362\u56FE\u7247\u3001\u5355\u6BB5/\u7EED\u62CD\u9884\u89C8\u3001\u5408\u5E76\u6210\u7247\u3001\u6062\u590D\u540E\u6210\u679C\u3001\u5BFC\u51FAPDF\u7B49\uFF09\u90FD\u987B\u5728\u7528\u6237\u53EF\u89C1\u6B63\u6587\u7ED9\u51FA\u9010\u9879\u53EF\u70B9\u51FBMarkdown\u94FE\u63A5\uFF0C\u4E0D\u80FD\u53EA\u7ED9\u76EE\u5F55\u3001\u53CD\u5F15\u53F7\u6216\u666E\u901A\u6587\u672C\u8DEF\u5F84\uFF1B\u672C\u5730\u8DEF\u5F84\u5148\u786E\u8BA4\u6587\u4EF6\u5B58\u5728\u5E76\u8F6C\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u7528\u5C16\u62EC\u53F7\u5305\u88F9\u3002\u56FE\u7247\u53E6\u987B\u5185\u5D4C\uFF0C\u811A\u672C\u53E6\u987B\u5B8C\u6574\u5C55\u793A\u6B63\u6587\uFF1Bpresent\u767B\u8BB0\u6210\u529F\u4ECD\u4FDD\u7559\u94FE\u63A5\uFF0C\u4E0D\u58F0\u79F0\u5361\u7247\u5DF2\u64AD\u653E\u3002\u53EA\u94FE\u63A5\u771F\u5B9E\u8FD4\u56DE\u6216\u5DF2\u6838\u5B9E\u6587\u4EF6\uFF0C\u4E0D\u7F16\u9020\u8DEF\u5F84\uFF0C\u4E0D\u4E3A\u8865\u94FE\u63A5\u91CD\u65B0\u4ED8\u8D39\u751F\u6210\u3002\u6062\u590D\u76EE\u5F55\u3001\u4EFB\u52A1ID\u3001\u914D\u7F6E\u6587\u4EF6\u7B49\u5185\u90E8\u53C2\u6570\u7EE7\u7EED\u6309\u539F\u53C2\u6570\u4F7F\u7528\uFF0C\u4E0D\u5F53\u4F5C\u53EF\u64AD\u653E\u6210\u679C\u3002",
    "\xB7 \u89C6\u9891\u6587\u4EF6\u94FE\u63A5\uFF1A\u89C6\u9891\u4EA4\u4ED8\u6B63\u6587\u5FC5\u987B\u9010\u9879\u9644Markdown\u53EF\u70B9\u51FB\u94FE\u63A5\uFF0C\u4F8B\u5982[\u89C2\u770B\u7B2C\u4E00\u6BB5](<\u7EDD\u5BF9\u6587\u4EF6\u8DEF\u5F84>)\uFF0C\u8DEF\u5F84\u542B\u7A7A\u683C\u4E5F\u7528\u5C16\u62EC\u53F7\u5305\u88F9\uFF1B\u6709present\u4ECD\u987B\u7ED9\u6B63\u6587\u94FE\u63A5\uFF0C\u666E\u901A\u6587\u672C\u6216\u53CD\u5F15\u53F7\u8DEF\u5F84\u4E0D\u7B97\u94FE\u63A5\uFF0C\u672A\u7ECF\u9A8C\u8BC1\u4E0D\u5F97\u8BF4\u4E0A\u65B9\u5361\u7247\u53EF\u76F4\u63A5\u64AD\u653E\u3002\u7F3A\u6587\u4EF6\u5148\u67E5\u539F\u4EFB\u52A1\u548C\u4EA4\u4ED8\u8DEF\u5F84\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u3002",
    "\xB7 \u4EA4\u4ED8\u6587\u4EF6\u6392\u5E8F\uFF1A\u4EA4\u4ED8\u6587\u4EF6\u987A\u5E8F\u7EDF\u4E00\u4E3A\uFF1A\u5408\u5E76\u540E\u7684\u5B8C\u6574\u89C6\u9891\u7B2C\u4E00\uFF0C\u5176\u540E\u4F9D\u6B21\u4E3A\u7B2C\u4E00\u6BB5\u3001\u7B2C\u4E8C\u6BB5\u53CA\u540E\u7EED\u5206\u6BB5\uFF1Bpresent\u8C03\u7528\u3001\u6B63\u6587\u6587\u4EF6\u94FE\u63A5\u548C\u4EA4\u4ED8\u6E05\u5355\u90FD\u9075\u5B88\u6B64\u987A\u5E8F\u3002\u6682\u505C\u65F6\u5DF2\u6709\u7D2F\u8BA1\u5408\u5E76\u89C6\u9891\u6807\u4E3A\u201C\u5DF2\u5B8C\u6210\u90E8\u5206\u5408\u5E76\u89C6\u9891\u201D\uFF0C\u4E0D\u6807\u6210\u5B8C\u6574\u6210\u7247\uFF1B\u5408\u5E76\u5931\u8D25\u6216\u672A\u5408\u5E76\u65F6\u53EA\u6309\u6BB5\u53F7\u4EA4\u4ED8\u771F\u5B9E\u6587\u4EF6\u3002",
    "\xB7 \u957F\u89C6\u9891\u4EA4\u4ED8\uFF1A\u76EE\u6807\u8D85\u8FC715\u79D2\u4E14\u5B9E\u9645\u5206\u6BB5\u751F\u6210\u65F6\uFF0C\u6BCF\u6B21\u5DE5\u5177\u8FD4\u56DE\u540E\u5206\u522B\u5C55\u793A\u5168\u90E8\u5DF2\u5B8C\u6210\u5206\u6BB5\uFF1B\u5168\u90E8\u751F\u6210\u4E14\u5408\u5E76\u6210\u529F\u65F6\uFF0C\u5148\u5C55\u793A\u5408\u5E76\u540E\u5B8C\u6574\u89C6\u9891\uFF0C\u518D\u6309\u6BB5\u53F7\u5C55\u793A\u7B2C\u4E00\u6BB5\u3001\u7B2C\u4E8C\u6BB5\u53CA\u540E\u7EED\u5206\u6BB5\u3002\u4F7F\u7528 present/\u6587\u4EF6\u5C55\u793A\u5DE5\u5177\u9010\u9879\u5C55\u793A\u5E76\u6807\u6CE8\u6BB5\u53F7\uFF0Cpresent \u7684 files \u6570\u7EC4\u7B2C\u4E00\u4E2A\u5FC5\u987B\u662F\u5408\u5E76\u6210\u7247\uFF0C\u5176\u540E\u624D\u6309\u6BB5\u53F7\u653E\u5206\u6BB5\uFF1B\u987A\u5E8F\u4E0D\u5BF9\u6216\u53EA\u5C55\u793A\u5206\u6BB5\u65F6\u63D2\u4EF6\u4F1A\u62E6\u4E0B\u8FD9\u6B21 present\uFF0C\u6309\u63D0\u793A\u628A\u6210\u7247\u632A\u5230\u7B2C\u4E00\u4E2A\u518D\u91CD\u53D1\u5373\u53EF\uFF0C\u4E0D\u5F97\u56E0\u6B64\u7701\u7565\u6210\u7247\u6216\u5206\u6BB5\u3002\u4E0D\u5F97\u53EA\u7ED9\u5408\u5E76\u89C6\u9891\u3001\u53EA\u7ED9\u6700\u540E\u4E00\u6BB5\u6216\u53EA\u5217\u76EE\u5F55\u3002\u6682\u505C\u65F6\u5148\u4EA4\u4ED8\u5DF2\u5B8C\u6210\u5206\u6BB5\uFF0C\u5408\u5E76\u5931\u8D25\u4ECD\u4EA4\u4ED8\u5206\u6BB5\u5E76\u6309\u539Fresume\u91CD\u8BD5\u4EA4\u4ED8\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u3002\u53EA\u4F7F\u7528\u7ED3\u679C\u4E2D\u771F\u5B9E\u8FD4\u56DE\u7684localPath/videoUrl\u548C\u5DF2\u786E\u8BA4\u5408\u5E76\u7684videoPath\uFF1B\u5355\u6BB5\u76F4\u51FA\u4E0D\u865A\u6784\u7B2C\u4E8C\u6BB5\u6216\u5408\u5E76\u7ED3\u679C\u3002",
    "\xB7 \u91CD\u7F6E\u63D2\u4EF6\u540E\u7684\u6062\u590D\uFF1A\u91CD\u7F6E\u53EA\u6E05\u9664\u914D\u7F6E\u4E0E\u767B\u5F55\u72B6\u6001\uFF0C\u4E0D\u4EE3\u8868\u63D2\u4EF6\u88AB\u5378\u8F7D\u6216\u505C\u7528\u3002\u5148\u8C03\u7528 video_config(action:get) \u6838\u5BF9\u5F53\u524D\u5B9E\u9645\u63A5\u5165\u4E0E\u5BC6\u94A5\u72B6\u6001\uFF0C\u4E0D\u6CBF\u7528\u91CD\u7F6E\u524D\u7684\u914D\u7F6E\u7ED3\u8BBA\uFF1B\u670D\u52A1\u7AEF\u6A21\u5F0F\u5F15\u5BFC\u63D2\u4EF6\u8BE6\u60C5\u9875\u767B\u5F55\uFF0CMetaOntic AI \u5F15\u5BFC\u9009\u62E9\u8BE5\u63A5\u5165\u5E76\u586B\u5199\u89C6\u9891/\u56FE\u7247 Key \u540E\u4FDD\u5B58\uFF0C\u706B\u5C71\u76F4\u8FDE\u586B\u5199\u706B\u5C71 Key \u540E\u4FDD\u5B58\u3002\u4E0D\u8981\u5728\u804A\u5929\u4E2D\u7D22\u53D6\u6216\u5C55\u793A Key\u3002\u7F3A Key\u3001\u91CD\u7F6E\u540E\u672A\u914D\u7F6E\u3001\u4FDD\u5B58\u5931\u8D25\u4E0D\u5C5E\u4E8E\u5DE5\u5177\u7F3A\u5931\uFF0C\u7981\u6B62\u636E\u6B64\u5EFA\u8BAE\u91CD\u88C5\u3001\u91CD\u65B0\u542F\u7528\u6216\u91CD\u542F App\uFF1B\u53EA\u6709\u660E\u786E restart-required \u624D\u63D0\u793A\u91CD\u542F\u3002\u5DE5\u5177\u6682\u4E0D\u53EF\u89C1\u65F6\u5148\u5237\u65B0\u5DE5\u5177\u53D1\u73B0\u6216\u8BA9\u7528\u6237\u91CD\u65B0\u6253\u5F00\u63D2\u4EF6\u8BE6\u60C5\u6838\u5BF9\u72B6\u6001\uFF1B\u4EC5\u786E\u8BA4\u5B9E\u9645\u672A\u5B89\u88C5/\u5DF2\u7981\u7528\u65F6\u624D\u6307\u5BFC\u5B89\u88C5/\u542F\u7528\u3002\u4FDD\u7559\u5DF2\u5BA1\u6838\u811A\u672C\u3001\u6E05\u6670\u5EA6\u3001\u6587\u4EF6\u3001\u4EFB\u52A1ID\u4E0E\u6062\u590D\u8FDB\u5EA6\uFF1B\u914D\u7F6E\u6062\u590D\u540E\u5148\u68C0\u67E5\u539F\u4EFB\u52A1\u72B6\u6001\uFF0C\u4E0D\u81EA\u52A8\u91CD\u65B0\u751F\u6210\u3001\u4E0D\u9ED8\u8BA4\u91CD\u95EE\u811A\u672C\uFF0C\u65E7\u786E\u8BA4\u7A97\u53E3\u5931\u6548\u65F6\u53EA\u8865\u7F3A\u5931\u7684\u5F53\u524D\u5236\u4F5C\u786E\u8BA4\uFF0C\u811A\u672C\u6216\u5236\u4F5C\u53C2\u6570\u53D8\u66F4\u4ECD\u987B\u91CD\u65B0\u5BA1\u6838\u4E0E\u8D39\u7528\u786E\u8BA4\u3002",
    "\xB7 \u771F\u4EBA\u56FE\u751F\u89C6\u9891\uFF1AA\u3001B \u6A21\u5F0F\u5206\u522B\u914D\u7F6E\u89C6\u9891\u6A21\u578B model \u4E0E\u56FE\u7247\u6A21\u578B imageModel\u3002\u56FE\u7247\u6A21\u578B\u652F\u6301 doubao-seedream-5-0-260128\u3001doubao-seedream-5-0-pro-260628\u3002\u52A9\u624B\u5148\u770B\u56FE\u6216\u6839\u636E\u7528\u6237\u8BF4\u660E\u5224\u65AD\u662F\u5426\u771F\u4EBA\uFF0C\u4E0D\u80FD\u770B\u56FE\u65F6\u5148\u6F84\u6E05\uFF0C\u4E0D\u80FD\u5047\u79F0\u5DF2\u81EA\u52A8\u8BC6\u522B\u3002\u786E\u8BA4\u771F\u4EBA\u65F6\uFF0C\u5148\u4E0E\u7528\u6237\u786E\u5B9A\u660E\u663E\u975E\u771F\u4EBA\u98CE\u683C\uFF0C\u5728\u5236\u4F5C\u786E\u8BA4\u4E2D\u8BF4\u660E\u56FE\u7247\u9884\u5904\u7406\u53E6\u884C\u8BA1\u8D39\uFF1B\u4F7F\u7528 video_prepare_image \u5904\u7406\u6BCF\u4E00\u5F20\u771F\u4EBA\u53C2\u8003\u56FE\uFF08\u542B\u9996\u5C3E\u5E27\uFF09\uFF0C\u5C55\u793A\u8FD4\u56DE\u56FE\u7247\u5E76\u6838\u5BF9\u5DF2\u6210\u4E3A\u975E\u771F\u4EBA\u89D2\u8272\u540E\uFF0C\u4EC5\u5C06\u5904\u7406\u7ED3\u679C\u7528\u4E8E\u89C6\u9891\u3002\u5373\u4F7F\u4E8B\u5148\u6CA1\u6709\u8BC6\u522B\u5230\u771F\u4EBA\uFF0C\u89C6\u9891\u63A5\u53E3\u660E\u786E\u8FD4\u56DE\u771F\u4EBA\u9650\u5236\u65F6\uFF0C\u63D2\u4EF6\u4F1A\u53E6\u884C\u8BE2\u95EE\u662F\u5426\u7528 Seedream \u8F6C\u4E3A\u975E\u771F\u4EBA\u4E8C\u7EF4\u52A8\u753B\u98CE\u683C\uFF0C\u9010\u5F20\u4FDD\u5B58\u56FE\u7247\u4EFB\u52A1\u548C\u7ED3\u679C\uFF1B\u8F6C\u6362\u5B8C\u6210\u8FD4\u56DEreview_required\u540E\uFF0C\u5FC5\u987B\u9010\u5F20\u5C55\u793A\u56FE\u7247\u5E76\u7B49\u7528\u6237\u6838\u5BF9\u4E3A\u975E\u771F\u4EBA\u4E14\u540C\u610F\u91CD\u8BD5\uFF0C\u518D\u5E26\u539Fresume\u548CreferenceImagesReviewed:true\u7EED\u505A\u4E00\u6B21\uFF0C\u8BF4\u660E\u56FE\u7247\u4E0E\u89C6\u9891\u91CD\u8BD5\u5206\u522B\u8BA1\u8D39\uFF1B\u53EA\u6709\u7528\u6237\u660E\u786E\u5141\u8BB8\u624D\u8F6C\u6362\uFF0C\u62D2\u7EDD\u3001\u53D6\u6D88\u6216\u65E0\u6CD5\u786E\u8BA4\u90FD\u505C\u6B62\uFF0C\u7981\u6B62\u52A9\u624B\u7ED5\u8FC7\u786E\u8BA4\u6216\u81EA\u884C\u91CD\u590D\u63D0\u4EA4\u3002\u5904\u7406\u5931\u8D25\u6216\u7ED3\u679C\u4ECD\u50CF\u771F\u4EBA\u5219\u505C\u6B62\uFF0C\u4E0D\u5C06\u539F\u771F\u4EBA\u56FE\u63D0\u4EA4\u89C6\u9891\uFF0C\u4E5F\u4E0D\u53CD\u590D\u81EA\u52A8\u91CD\u8BD5\u4ED8\u8D39\u8C03\u7528\u3002\u975E\u771F\u4EBA\u539F\u56FE\u76F4\u63A5\u4F7F\u7528\u3002C \u6A21\u5F0F\u76EE\u524D\u672A\u63A5\u6B64\u5DE5\u5177\uFF0C\u987B\u5148\u51C6\u5907\u975E\u771F\u4EBA\u53C2\u8003\u56FE\u3002",
    "\xB7 \u63D0\u4EA4\u8D85\u65F6\u3001\u65AD\u7F51\u6216\u54CD\u5E94\u7F3A\u5C11ID\u65F6\uFF0C\u82E5\u8FD4\u56DEsubmission_unknown\u53CA\u63D0\u4EA4\u8BB0\u5F55ID\uFF0C\u7981\u6B62\u91CD\u65B0\u751F\u6210\uFF1B\u5148\u7528media_submission\u8BFB\u53D6\u8BB0\u5F55\u5E76\u8BA9\u7528\u6237\u6838\u5BF9\u6E20\u9053\u65E5\u5FD7\u3002\u627E\u5230\u539F\u4EFB\u52A1ID\u540E\u5173\u8054\u67E5\u8BE2\uFF1B\u53EA\u6709\u7528\u6237\u660E\u786E\u786E\u8BA4\u672A\u521B\u5EFA\uFF0C\u624D\u89E3\u9501\u5E76\u7ECF\u8D39\u7528\u786E\u8BA4\u540E\u518D\u6B21\u63D0\u4EA4\u3002\u63D2\u4EF6\u4E0D\u5047\u8BBE\u4E2D\u8F6C\u7AD9\u652F\u6301\u5E42\u7B49\u3002\u8F6C\u6362\u7684\u9636\u6BB5\u3001\u4EFB\u52A1\u4E0E\u7ED3\u679C\u968F\u65AD\u70B9\u4FDD\u5B58\uFF0C\u7EED\u505A\u4E0D\u4ECE\u5934\u8F6C\u6362\u3002",
    "\u672C\u6BB5\u662FMetaOnticVideo\u5F53\u524D\u751F\u6548\u7684\u64CD\u4F5C\u89C4\u5219\uFF0C\u70ED\u52A0\u8F7D\u540E\u73B0\u6709\u5BF9\u8BDD\u4ECE\u4E0B\u4E00\u8F6E\u6309\u672C\u6BB5\u6267\u884C\uFF1B\u6B64\u524D\u5BF9\u8BDD\u6216\u65E7\u7248\u63D2\u4EF6\u9884\u8BBE\u4E2D\u7684\u8FC7\u65F6\u4EA4\u4E92\u8BF4\u660E\u4EE5\u672C\u6BB5\u4E3A\u51C6\uFF0C\u4ECD\u9075\u5B88\u7528\u6237\u5F53\u524D\u660E\u786E\u8981\u6C42\u3002\u65E0\u9700\u4E3A\u4E86\u5E94\u7528\u8FD9\u4E9B\u89C4\u5219\u65B0\u5EFA\u5BF9\u8BDD\u3002\u4FDD\u7559\u65E2\u6709\u811A\u672C\u3001\u6587\u4EF6\u4E0E\u4EFB\u52A1ID\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u5DF2\u5B8C\u6210\u7684\u89C6\u9891\uFF1B\u5DF2\u6253\u5F00\u7684\u65E7\u786E\u8BA4\u7A97\u53E3\u4E0D\u4F1A\u81EA\u52A8\u6539\u5199\uFF0C\u7528\u6237\u8981\u6C42\u91CD\u5F00\u6216\u6539\u7A3F\u65F6\u5148\u91CD\u65B0\u5C55\u793A\u5F53\u524D\u7248\u6750\u6599\u5E76\u53D1\u8D77\u65B0\u95EE\u9898\uFF0C\u4E0D\u6CBF\u7528\u65E7\u95EE\u9898\u7684\u7B54\u590D\u3002",
    "\u63D0\u793A\u8BCD\u9075\u5FAA\u706B\u5C71\u8FDB\u9636\u539F\u5219\uFF1A\u5148\u5B9A\u4E49\u4E3B\u4F53\u76842\u20133\u4E2A\u7A33\u5B9A\u7279\u5F81\u5E76\u56FA\u5B9A\u6807\u7B7E\uFF0C\u518D\u5199\u6709\u627F\u63A5\u5173\u7CFB\u7684\u52A8\u4F5C\u3001\u573A\u666F\u5149\u7EBF\u3001\u8FD0\u955C\u548C\u97F3\u9891\uFF1B\u5C11\u5199\u91CD\u590D\u9650\u5236\u3002\u591A\u6BB5\u65F6\u5FC5\u987B\u51C6\u5907segmentPrompts\uFF0C\u6BCF\u6BB5\u4EC5\u542B\u65B0\u589E\u4E8B\u4EF6\u548C\u5BF9\u767D\u30022.0\u6309\u4E8B\u4EF6\u987A\u5E8F\u81EA\u7136\u8282\u594F\uFF0C2.5\u53EF\u7528\u8FDE\u7EED\u79D2\u7EA7\u533A\u95F4\uFF1B\u5B8C\u6574\u5267\u672C\u7559\u5728script.md\uFF0C\u4E0D\u76F4\u63A5\u53CD\u590D\u53D1\u7ED9\u6A21\u578B\u3002",
    "\xB7 \u5BF9\u767D\u53D1\u97F3\u6821\u5BF9\uFF1A\u811A\u672C\u5BA1\u6838\u524D\u8BFB\u53D6video-director\u7684references/pronunciation.md\uFF0C\u68C0\u67E5\u591A\u97F3\u5B57\u3001\u751F\u50FB\u5B57\u3001\u4E13\u540D\u3001\u6570\u5B57\u3001\u5355\u4F4D\u548C\u7F29\u5199\u3002\u4FDD\u7559\u811A\u672C\u53CA\u5B57\u5E55\u6B63\u786E\u539F\u6587\uFF0C\u53E6\u5217\u201C\u539F\u6587\u2192\u53D1\u97F3\u6587\u672C\u201D\u7528\u4E8E\u751F\u6210\uFF1B\u4EC5\u5BF9\u8BFB\u97F3\u660E\u786E\u7684\u6613\u9519\u8BCD\u7528\u5E38\u7528\u540C\u97F3\u5B57\uFF0C\u4E0D\u5168\u6587\u66FF\u6362\u3001\u4E0D\u7528\u62FC\u97F3\u5192\u5145\u53EF\u9760\u4FEE\u97F3\u3002\u4E13\u540D\u8BFB\u97F3\u4E0D\u660E\u5148\u6F84\u6E05\uFF0C\u6D89\u53CA\u539F\u610F\u6216\u53F0\u8BCD\u5185\u5BB9\u53D8\u5316\u987B\u5728\u811A\u672C\u5BA1\u6838\u4E2D\u786E\u8BA4\u3002\u53F0\u8BCD\u7528{\u53F0\u8BCD}\uFF0C\u97F3\u6548\u7528<\u97F3\u6548>\uFF0C\u97F3\u4E50\u7528(\u97F3\u4E50)\uFF0C\u660E\u786E\u8BF4\u8BDD\u8005\u3001\u8BED\u8A00\u548C\u5148\u540E\u987A\u5E8F\uFF0C\u907F\u514D\u65E0\u5FC5\u8981\u7684\u4E2D\u82F1\u6587\u6DF7\u8BFB\u3002\u6309\u5B9E\u9645\u53D1\u58F0\u65F6\u95F4\u7EA63\u20134\u5B57/\u79D2\u521D\u4F30\u5E76\u7559\u505C\u987F\u3001\u52A8\u4F5C\u548C\u6536\u5C3E\uFF1B\u8FC7\u5BC6\u5148\u8C03\u6574\u5206\u914D\uFF0C\u4FEE\u6539\u7528\u6237\u5173\u952E\u53F0\u8BCD\u987B\u7ECF\u5BA1\u6838\u3002segmentPrompts\u4EC5\u542B\u672C\u6BB5\u5B8C\u6574\u65B0\u53F0\u8BCD\u4E0E\u9700\u8981\u7684\u53D1\u97F3\u6587\u672C\uFF0C\u4E0D\u8DE8\u6BB5\u622A\u65AD\u4E00\u53E5\u3001\u4E0D\u5939\u5E26\u5DF2\u8BF4\u53F0\u8BCD\u6216\u628A\u6620\u5C04\u8BF4\u660E\u5F53\u5BF9\u767D\u3002\u751F\u6210\u540E\u987B\u5B9E\u9645\u8BD5\u542C\u624D\u80FD\u5224\u65AD\u5410\u5B57\uFF0C\u4E0D\u5F97\u4EC5\u51ED\u6210\u529F\u72B6\u6001\u58F0\u79F0\u51C6\u786E\uFF1B\u65E0\u6CD5\u8BD5\u542C\u5219\u660E\u786E\u5F85\u7528\u6237\u6838\u542C\u3002\u8BEF\u8BFB\u53EA\u4FEE\u5BF9\u5E94\u7247\u6BB5\uFF0C\u91CD\u65B0\u751F\u6210\u524D\u8BF4\u660E\u8BA1\u8D39\u5E76\u53D6\u5F97\u540C\u610F\uFF0C\u4E0D\u81EA\u52A8\u4ED8\u8D39\u91CD\u8BD5\u3002\u9010\u5B57\u51C6\u786E\u8981\u6C42\u53EF\u5EFA\u8BAE\u6821\u5BF9\u914D\u97F3\u540E\u671F\u66FF\u6362\uFF0C\u4F46\u5F53\u524D\u63D2\u4EF6\u672A\u5B9E\u73B0\u81EA\u52A8\u914D\u97F3\u6216\u53E3\u578B\u4FEE\u590D\uFF0C\u4E0D\u627F\u8BFA\u97F3\u9891\u53C2\u8003\u4FDD\u8BC1\u9010\u5B57\u6B63\u786E\u3002",
    isMetaontic(config) ? "\u5F53\u524D\u4E3A B MetaOntic AI\uFF1A\u4F7F\u7528 metaonticApiKey \u548C\u670D\u52A1\u7AEF\u6A21\u5F0F\u76F8\u540C\u7684\u4E2D\u8F6C\u5730\u5740\uFF0C\u65E0\u9700\u767B\u5F55\uFF1B\u811A\u672C\u5BA1\u6838\u524D\u8C03\u7528video_estimate\u63D0\u4F9B\u53CC\u65B9\u6848\u57FA\u7840\u4F30\u4EF7\uFF1B\u4E0D\u6267\u884C\u989D\u5EA6\u6216\u4F7F\u7528\u8BB0\u5F55\u67E5\u8BE2\uFF1B\u8FD9\u4E9B\u5185\u90E8\u89C4\u5219\u4E0D\u5199\u8FDB\u7528\u6237\u8D39\u7528\u8BF4\u660E\u3002\u5236\u4F5C\u524D\u5C55\u793A\u5F53\u524D\u811A\u672C\u7684\u53CC\u65B9\u6848\u57FA\u7840\u4F30\u4EF7\u5E76\u8BF4\u660E\u201C\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\u201D\uFF0C\u518D\u8BE2\u95EE\u662F\u5426\u5F00\u59CB\uFF1B\u521B\u5EFA\u6210\u529F\u4E0D\u4EE3\u8868\u751F\u6210\u6210\u529F\uFF0C\u5FC5\u987B\u67E5\u8BE2\u81F3succeeded\u4E14\u6709\u89C6\u9891\u5730\u5740\u3002\u4E0B\u8FF0\u767B\u5F55\u9886 Key \u89C4\u5219\u4EC5\u9002\u7528\u4E8E A \u670D\u52A1\u7AEF\u6A21\u5F0F\u3002" : isVolcengine(config) ? "\u5F53\u524D\u4E3A C \u706B\u5C71\u76F4\u8FDE\uFF1A\u4F7F\u7528 volcengineApiKey\uFF0C\u65E0\u9700\u670D\u52A1\u7AEF\u767B\u5F55\uFF1B\u811A\u672C\u5BA1\u6838\u524D\u8C03\u7528video_estimate\u5C55\u793A\u53CC\u65B9\u6848\u57FA\u7840\u4F30\u4EF7\uFF0C\u63D2\u4EF6\u8DEF\u7EBF\u6309\u706B\u5C71\u76F4\u8FDE\u4EF7\u3001\u4E0D\u5957\u4E2D\u8F6C\u6298\u6263\uFF1B\u5185\u90E8\u4E0D\u67E5\u8BE2\u4F59\u989D\uFF0C\u4E0D\u628A\u8FD9\u4E9B\u5185\u90E8\u89C4\u5219\u5199\u8FDB\u7528\u6237\u8D39\u7528\u8BF4\u660E\u3002\u4EC5\u6309\u521B\u5EFA\u4EFB\u52A1\u4E0E\u67E5\u8BE2\u4EFB\u52A1\u63A5\u53E3\u7684\u5B9E\u9645\u7ED3\u679C\u62A5\u544A\u72B6\u6001\uFF1B\u521B\u5EFA\u6210\u529F\u4E0D\u4EE3\u8868\u89C6\u9891\u5DF2\u751F\u6210\uFF0C\u5FC5\u987B\u67E5\u8BE2\u81F3succeeded\u4E14\u6709\u89C6\u9891\u5730\u5740\u3002\u4E0B\u8FF0\u670D\u52A1\u7AEF\u9886 Key \u8981\u6C42\u4EC5\u9002\u7528\u4E8E A \u6A21\u5F0F\u3002" : "\u5F53\u524D\u4E3A A \u670D\u52A1\u7AEF\u6A21\u5F0F\uFF1A\u5728\u8BBE\u7F6E\u9875\u767B\u5F55\u9886\u53D6 Key\u3002",
    "MetaOnticVideo\uFF08Seedance \u89C6\u9891\u751F\u6210\u63D2\u4EF6\uFF09\uFF1A\u9700\u8981\u751F\u6210\u89C6\u9891\u3001\u7ED9\u89C6\u9891\u52A0\u957F\u65F6\u4F18\u5148\u7528\u5B83\uFF1B\u7528\u6237\u53EA\u8981\u8BF4\u60F3\u8981\u591A\u957F\uFF08duration\uFF09\uFF0C\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\u7684\u90E8\u5206\u63D2\u4EF6\u81EA\u5DF1\u5206\u6BB5\u7EED\u62CD\u518D\u5408\u5E76\uFF0C\u4E0D\u7528\u7528\u6237\u81EA\u5DF1\u62C6\u4EFB\u52A1\u3002",
    "\xB7 \u5148\u8BC4\u4F30\u7528\u6237\u65B9\u6848\u5B8C\u6574\u5EA6\uFF1A\u4E3B\u9898/\u76EE\u6807\u3001\u4E3B\u4F53\u3001\u4E3B\u8981\u5185\u5BB9\u4E0E\u53D1\u5C55\u3001\u7ED3\u5C3E\u6216\u5C55\u793A\u7ED3\u679C\u53CA\u660E\u786E\u7EA6\u675F\u662F\u5426\u8DB3\u4EE5\u5199\u811A\u672C\uFF1B\u98CE\u666F\u4E0E\u5C55\u793A\u4E0D\u5F3A\u6C42\u51B2\u7A81\uFF0C\u7F3A\u65F6\u957F\u6216\u753B\u5E45\u53EF\u7528\u9ED8\u8BA4\u503C\uFF0C\u4E0D\u56E0\u6B64\u5224\u4E3A\u4E0D\u5B8C\u5584\u3002\u4E0D\u5B8C\u5584\u4E14\u5C1A\u672A\u6388\u6743\u65F6\uFF0C\u7B80\u77ED\u6307\u51FA\u5173\u952E\u7F3A\u53E3\uFF0C\u5148\u95EE\u201C\u8981\u4E0D\u8981\u6211\u5E2E\u4F60\u5B8C\u5584\u65B9\u6848\uFF1F\u201D\uFF0C\u63D0\u4F9B\u201C\u5E2E\u6211\u5B8C\u5584 / \u4FDD\u7559\u539F\u65B9\u6848\u201D\uFF0C\u7B49\u5F85\u660E\u786E\u7B54\u590D\uFF0C\u4E0D\u64C5\u81EA\u6269\u5199\u5267\u60C5\u3002\u5DF2\u6709\u201C\u4F60\u53D1\u6325\u201D\u201C\u5E2E\u6211\u5B8C\u5584\u201D\u7B49\u6388\u6743\u5219\u4E0D\u91CD\u590D\u8BE2\u95EE\u662F\u5426\u5B8C\u5584\uFF0C\u4F46\u5B8C\u5584\u524D\u5FC5\u987B\u786E\u8BA4\u521B\u610F\u65B9\u5411\uFF1A\u65B9\u5411\u4E0D\u660E\u786E\u65F6\u5148\u95EE\u4E00\u4E2A\u7B80\u77ED\u95EE\u9898\uFF0C\u63D0\u4F9B2\u20133\u4E2A\u7B80\u6D01\u3001\u4E92\u65A5\u7684\u5355\u9009\u65B9\u5411\u5E76\u5141\u8BB8\u81EA\u7531\u8F93\u5165\uFF0C\u7B49\u5F85\u7528\u6237\u7B54\u590D\u540E\u518D\u5B8C\u5584\uFF0C\u4E0D\u5F97\u81EA\u884C\u9009\u65B9\u5411\u6216\u968F\u610F\u8865\u5199\u5267\u60C5\u3002\u7528\u6237\u5DF2\u660E\u786E\u521B\u610F\u65B9\u5411\u65F6\u6309\u8BE5\u65B9\u5411\u5B8C\u5584\uFF0C\u4E0D\u91CD\u590D\u8BE2\u95EE\uFF0C\u4E0D\u64C5\u81EA\u6269\u5927\u8303\u56F4\u3002\u5B8C\u6574\u65B9\u6848\u4FDD\u7559\u4E3B\u9898\u3001\u89D2\u8272\u5173\u7CFB\u3001\u60C5\u8282\u987A\u5E8F\u3001\u7ED3\u5C3E\u3001\u5173\u952E\u5BF9\u767D\u3001\u98CE\u683C\u548C\u9650\u5236\uFF0C\u53EA\u6DA6\u8272\u63AA\u8F9E\u3001\u6574\u7406\u683C\u5F0F\u548C\u8F6C\u6210\u5206\u955C\uFF0C\u4E0D\u64C5\u81EA\u589E\u5220\u89D2\u8272/\u4E8B\u4EF6/\u53CD\u8F6C\u3002\u5185\u5BB9\u53D6\u820D\u3001\u65F6\u957F\u538B\u7F29\u6216\u5267\u60C5\u7ED3\u5C3E\u8C03\u6574\u987B\u5148\u5F81\u5F97\u540C\u610F\u3002\u7528\u6237\u9009\u62E9\u4FDD\u7559\u65F6\u5FE0\u4E8E\u539F\u610F\u6574\u7406\uFF0C\u4EC5\u6F84\u6E05\u65E0\u6CD5\u6267\u884C\u7684\u5FC5\u8981\u4FE1\u606F\u3002\u662F\u5426\u5B8C\u5584\u4E0D\u4EE3\u66FF\u811A\u672C\u5BA1\u6838\u6216\u5236\u4F5C\u6388\u6743\uFF1B\u5B8C\u6574\u65B9\u6848\u4E0D\u589E\u52A0\u5B8C\u5584\u8BE2\u95EE\u3002\u9ED8\u8BA415\u79D2\u30019:16\uFF0C\u89C6\u9891\u6E05\u6670\u5EA6\u4EC5\u652F\u6301480P\u3001720P\u3002\u6574\u7406\u811A\u672C\u65F6\u5FC5\u987B\u8BA9\u7528\u6237\u660E\u786E\u9009\u62E9\u6216\u786E\u8BA4\u6E05\u6670\u5EA6\uFF1B\u672A\u6307\u5B9A\u65F6\u901A\u8FC7\u63D0\u95EE\u5DE5\u5177\u63D0\u4F9B\u201C480P / 720P\u201D\u4E24\u4E2A\u5355\u9009\u9879\uFF0C\u4E0D\u5F97\u4EE5\u9ED8\u8BA4\u503C\u4EE3\u66FF\u7528\u6237\u786E\u8BA4\uFF0C\u672A\u7B54\u3001\u53D6\u6D88\u6216pending\u4E0D\u5F97\u81EA\u884C\u4F7F\u7528\u9ED8\u8BA4\u503C\u8FDB\u5165\u5236\u4F5C\u3002\u7528\u6237\u5728\u672C\u6B21\u9700\u6C42\u5DF2\u660E\u786E\u6307\u5B9A\u65F6\u76F4\u63A5\u8BB0\u5F55\uFF0C\u4E0D\u91CD\u590D\u8BE2\u95EE\u3002\u628A\u786E\u8BA4\u503C\u5199\u5165script.md\u7684\u201C\u89C6\u9891\u6E05\u6670\u5EA6\u201D\uFF0C\u811A\u672C\u89C4\u683C\u548C\u5236\u4F5C\u786E\u8BA4\u90FD\u5C55\u793A\u8BE5\u503C\uFF0C\u8C03\u7528video_generate/video_extend\u65F6\u663E\u5F0F\u4F20resolution=480p\u6216720p\uFF1B\u6539\u7A3F\u672A\u6D89\u53CA\u6E05\u6670\u5EA6\u65F6\u4FDD\u7559\u5DF2\u786E\u8BA4\u9009\u62E9\uFF0C\u6539\u53D8\u6E05\u6670\u5EA6\u987B\u91CD\u65B0\u786E\u8BA4\uFF0C\u6062\u590D\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u6CBF\u7528\u539F\u503C\uFF1B\u6309\u539F\u65B9\u6848\u786E\u5B9A\u98CE\u683C\u4E0E\u58F0\u97F3\uFF0C\u65E0\u5FC5\u8981\u4E0D\u52A0\u5BF9\u767D\uFF0C\u5B57\u5E55\u672A\u6307\u5B9A\u4E0D\u52A0\u3002\u6574\u7406\u540E\u5148\u5B8C\u6574\u5C55\u793A\u6545\u4E8B\u3001\u89C4\u683C/\u98CE\u683C/\u58F0\u97F3\u3001\u4EBA\u7269\u6216\u4E3B\u4F53\u548C\u65F6\u95F4/\u753B\u9762/\u5B8C\u6574\u5BF9\u767D\u8868\uFF0C\u518D\u5BA1\u6838\uFF1B\u6BCF\u6B21\u6539\u7A3F\u4FDD\u7559\u6EE1\u610F\u90E8\u5206\uFF0C\u4E0D\u8BA9\u7528\u6237\u6539\u6A21\u578B\u63D0\u793A\u8BCD\u3002\u63A5\u5165\u65B9\u5F0F\u4EC5\u7528\u4E8E\u8FDE\u63A5\u4E0E\u8D39\u7528\u5224\u65AD\uFF0C\u4E0D\u5F53\u4F5C\u521B\u4F5C\u80FD\u529B\u5199\u8FDB\u5BA3\u4F20\u89C6\u9891\uFF0C\u9664\u975E\u7528\u6237\u660E\u786E\u8981\u63A5\u5165\u6559\u7A0B\u3002",
    "\xB7 **\u751F\u6210\u4E00\u6761\u65B0\u89C6\u9891\u5FC5\u987B\u5148\u8FC7\u4E24\u9053\u786E\u8BA4\uFF0C\u7F3A\u4E00\u4E0D\u53EF**\uFF1A\u2460 \u5148\u628A**\u89C6\u9891\u811A\u672C**\u5199\u51FA\u6765\u4EA4\u7ED9\u7528\u6237**\u5BA1\u6838**\uFF08\u811A\u672C\u8981\u542B\uFF1A\u753B\u9762\u98CE\u683C\u3001\u4EBA\u7269\u5F62\u8C61\u3001\u5206\u955C\u2014\u2014\u9010\u955C\u7684\u955C\u5934 / \u65F6\u95F4 / \u753B\u9762\u3001\u5BF9\u767D\u2014\u2014\u6709\u5BF9\u8BDD\u5C31\u9010\u53E5\u5199\u6E05\u8C01\u5728\u51E0\u79D2\u8BF4\u4EC0\u4E48\uFF09\uFF1B\u2461 \u811A\u672C\u5BA1\u6838\u901A\u8FC7\u540E\uFF0C**\u518D\u5355\u72EC\u95EE\u4E00\u6B21\u8981\u4E0D\u8981\u5F00\u59CB\u505A**\uFF08\u6240\u6709\u63A5\u5165\u65B9\u5F0F\u5747\u590D\u8FF0\u5F53\u524D\u811A\u672C\u7684\u53CC\u65B9\u6848\u57FA\u7840\u4F30\u4EF7\u5E76\u8BF4\u660E\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\uFF1B\u4EC5\u670D\u52A1\u7AEF\u6A21\u5F0F\u6838\u5BF9\u989D\u5EA6\uFF09\uFF0C\u7528\u6237\u70B9\u5934\u4E86\u624D\u8C03\u7528 video_generate\u3002\u811A\u672C\u4E00\u6539\uFF0C\u4E24\u9053\u786E\u8BA4\u5168\u90E8\u4F5C\u5E9F\uFF0C\u8981\u91CD\u65B0\u8D70\u3002\u7528\u6237\u8BF4\u300C\u76F4\u63A5\u751F\u6210\u300D\u4E5F\u8981\u5148\u8D70\u8FD9\u4E24\u6B65\uFF0C\u4E0D\u8981\u8DF3\u8FC7\u3002\u7ED9\u5DF2\u6709\u89C6\u9891\u63A5\u957F\uFF08video_extend\uFF09\u4E0D\u9700\u8981\u811A\u672C\uFF0C\u4F46\u540C\u6837\u8981\u5148\u786E\u8BA4\u518D\u8C03\u7528\u3002",
    "\xB7 \u4EC5A/B\u63A5\u5165\uFF1Avideo_generate\u3001video_extend\u53CAvideo_status\u5B8C\u6210\u540E\u82E5\u8FD4\u56DEactualCost\uFF0C\u4EA4\u4ED8\u89C6\u9891\u65F6\u4E00\u5E76\u5C55\u793A\u4E2D\u8F6C\u7AD9\u771F\u5B9E\u6D88\u8017\uFF08\u9010\u4EFB\u52A1\u548C\u5408\u8BA1\uFF09\uFF1Bpaused\u53EA\u79F0\u5DF2\u751F\u6210\u90E8\u5206\uFF0Cpartial\u53EA\u79F0\u5DF2\u7ED3\u7B97\u5C0F\u8BA1\uFF0Cpending\u8BF4\u660E\u5F85\u7ED3\u7B97/\u5F85\u67E5\u8BE2\u3002\u5B9E\u9645\u91D1\u989D\u53D6\u4E2D\u8F6C\u6700\u7EC8\u7ED3\u7B97\u800C\u975E\u4F30\u4EF7\u3001\u9884\u6263\u6216\u4F59\u989D\u5DEE\uFF1B\u6CA1\u6709\u91D1\u989D\u4E0D\u8981\u62A50\u3002\u53EF\u7528\u539FtaskId\u8C03\u7528video_status\u8865\u67E5\u8D39\u7528\uFF0C\u4E0D\u56E0\u8D39\u7528\u7F3A\u5931\u91CD\u65B0\u751F\u6210\u3001\u91CD\u8BD5\u4ED8\u8D39\u4EFB\u52A1\u6216\u5EF6\u8FDF\u4EA4\u4ED8\u3002\u53EA\u7EDF\u8BA1\u89C6\u9891\u8D39\u7528\uFF0C\u56FE\u7247\u4E0E\u989D\u5916\u91CD\u505A\u53E6\u8BA1\uFF1BC\u706B\u5C71\u76F4\u8FDE\u4E0D\u63D0\u4F9B\u6B64\u4E2D\u8F6C\u8D26\u5355\u67E5\u8BE2\u3002",
    "\xB7 \u6BCF\u6B21\u65B0\u811A\u672C\u53CA\u6539\u7A3F\u5BA1\u6838\u524D\uFF0C\u65E0\u8BBA\u5355\u6BB5\u8FD8\u662F\u591A\u6BB5\uFF0C\u90FD\u5148\u8BFB\u53D6video-director\u7684references/segment-storyboard.md\u5E76\u5B9E\u9645\u5C55\u793A\u5F53\u524D\u7248\u955C\u5934\u53C2\u8003\u793A\u610F\u56FE\uFF1B\u4E00\u955C\u5230\u5E95\u4E5F\u5C55\u793A\u5173\u952E\u6784\u56FE\u4E0E\u52A8\u4F5C\u3002\u9700\u8981\u62C6\u5206\u751F\u6210\u65F6\u53E6\u5C55\u793A\u5206\u6BB5\u8868\uFF08\u6BB5\u53F7\u3001\u5168\u7247\u65F6\u95F4\u3001\u751F\u6210\u65F6\u957F\u3001\u751F\u6210/\u7EED\u62CD\u3001\u4E3B\u8981\u753B\u9762\u4E0E\u65B0\u5BF9\u767D\u3001\u8D77\u6B62\u72B6\u6001\u53CA\u4EA4\u63A5\uFF09\u3002\u6309\u5F53\u524D\u6A21\u578B\u548C\u5B9E\u9645\u5206\u6BB5\u89C4\u5219\u6838\u5BF9\uFF0C\u4E0D\u8C03\u7528\u751F\u6210\u5DE5\u5177\u8BD5\u7B97\uFF0C\u4E0D\u6309\u5206\u955C\u6570\u589E\u52A0\u4ED8\u8D39\u8C03\u7528\u3002\u7528\u672C\u5730SVG/PNG\u753B\u672C\u7248\u6784\u56FE\u4E0E\u52A8\u4F5C\u793A\u610F\u56FE\uFF0CHTML\u53EF\u4F5C\u9644\u52A0\u9884\u89C8\uFF1Bpresent\u767B\u8BB0\u540E\uFF0C\u5728\u6B63\u6587\u5185\u5D4C\u5F53\u524D\u7248\u56FE\u7247\u5E76\u7ED9\u6253\u5F00\u539F\u56FE\u94FE\u63A5\uFF0C\u660E\u786E\u6807\u6CE8\u201C\u793A\u610F\uFF0C\u975E\u5B9E\u9645\u751F\u6210\u753B\u9762\u201D\uFF0C\u5148\u53D1\u56FE\u7247\u6B63\u6587\u518D\u5F39\u811A\u672C\u5BA1\u6838\u7A97\u3002\u6539\u7A3F\u540C\u6B65\u66F4\u65B0\u56FE\u8868\uFF0C\u4E0D\u589E\u52A0\u7B2C\u4E09\u9053\u786E\u8BA4\uFF1B\u793A\u610F\u56FE\u4E0D\u80FD\u4EE3\u66FF\u771F\u5B9E\u9010\u6BB5\u9884\u89C8\u3002\u9ED8\u8BA4\u4E0D\u8C03\u7528\u4ED8\u8D39\u51FA\u56FE\u6A21\u578B\uFF0C\u89D2\u8272\u53C2\u8003\u56FE\u53EF\u5728\u53D6\u5F97\u540C\u610F\u540E\u7528video_prepare_image\u7684create_character\u751F\u6210\uFF0C\u56FE\u7247\u5355\u72EC\u8BA1\u8D39\uFF1B\u5206\u955C\u793A\u610F\u56FE\u4ECD\u4F7F\u7528\u672C\u5730\u7ED8\u5236\uFF0C\u4E0D\u80FD\u6DF7\u4E3A\u540C\u4E00\u6D41\u7A0B\u3002",
    "\xB7 \u4E0D\u8BBA\u63A5\u5165\u65B9\u5F0F\u662FMetaOnticVideo\u3001MetaOntic AI\u8FD8\u662F\u706B\u5C71\u76F4\u8FDE\uFF0C\u5747\u5FC5\u987B\u9884\u4F30\u8D39\u7528\uFF0C\u4E0D\u5F97\u8DF3\u8FC7\u3002\u6BCF\u6B21\u811A\u672C\u5BA1\u6838\u524D\u5148\u8C03\u7528\u53EA\u8BFBvideo_estimate\uFF08\u76EE\u6807\u603B\u65F6\u957F\u3001\u7528\u6237\u5DF2\u786E\u8BA4resolution\u3001\u753B\u5E45\u548C\u771F\u5B9EsegmentSeconds\uFF09\uFF0C\u5C06\u8FD4\u56DE\u7684\u706B\u5C71\u5B98\u65B9\u65B9\u6848\u4E0EMetaOnticVideo\u63D2\u4EF6\u65B9\u6848\u4E24\u9879\u4EBA\u6C11\u5E01\u57FA\u7840\u4F30\u4EF7\u3001\u5404\u81EA\u6A21\u578B/\u5206\u6BB5/\u500D\u7387/\u65E5\u671F\u5199\u5165script.md\u6700\u540E\u7684\u201C\u8D39\u7528\u9884\u4F30\u201D\u4E00\u8282\uFF0C\u653E\u5728\u5B8C\u6574\u5267\u60C5\u3001\u5206\u955C\u3001\u5BF9\u767D\u3001\u7ED3\u5C3E\u53CA\u5206\u6BB5\u65B9\u6848\u4E4B\u540E\uFF1B\u6B63\u6587\u5C55\u793A\u811A\u672C\u65F6\u4E5F\u6309\u76F8\u540C\u987A\u5E8F\u5728\u672B\u5C3E\u5B8C\u6574\u5C55\u793A\u8FD9\u4E24\u9879\u91D1\u989D\u4E0E\u8BA1\u8D39\u524D\u63D0\uFF0C\u518D\u5F39\u5BA1\u6838\u7A97\u53E3\u3002\u4E0D\u5F97\u53EA\u5199\u5728\u5DE5\u5177\u7ED3\u679C\u3001\u6587\u4EF6\u5916\u7684\u8865\u5145\u6D88\u606F\u6216\u5236\u4F5C\u786E\u8BA4\u91CC\u3002\u706B\u5C71\u5B98\u65B9\u53C2\u7167\u4E00\u5F8B\u91C7\u7528 Seedance 2.5\uFF0C\u4E00\u6BB5\u5C31\u662F 30 \u79D2\uFF1A\u4E0D\u8DB3 30 \u79D2\u7684\u5C3E\u6BB5\u4E5F\u6309 30 \u79D2\u8BA1\uFF0C\u4E0D\u6309\u5269\u4F59\u79D2\u6570\u6298\u534A\uFF1B\u8D85\u8FC7 30 \u79D2\u4E5F\u5FC5\u987B\u5982\u5B9E\u5217\u4E3A\u591A\u6B21\u751F\u6210/\u7EED\u62CD\uFF0C\u4E0D\u79F0\u4E00\u6B21\u76F4\u51FA\uFF1B\u63D2\u4EF6\u6309\u5F53\u524D\u5B9E\u9645\u6A21\u578B\u4E0E\u5206\u6BB5\u65B9\u6848\uFF0C\u7EED\u62CD\u5305\u542B\u4E0A\u4E00\u6BB5\u5B8C\u6574\u89C6\u9891\u8F93\u5165\u3002\u624B\u586BKey\u672A\u6838\u5B9E\u5206\u7EC4\u4E0D\u5F97\u5047\u8BBE0.8\u6298\u6263\uFF1B\u4E0D\u628A\u53C2\u8003\u56FE\u7247\u5F53\u53C2\u8003\u89C6\u9891\u8BA1\u4EF7\u3002\u5FC5\u987B\u6807\u660E\u6700\u4F4E\u7528\u91CF\u8865\u8DB3\u672A\u8BA1\u5165\u3001\u56FE\u7247\u8F6C\u6362/\u91CD\u505A/\u72EC\u7ACB\u914D\u97F3\u53E6\u8BA1\u3001\u5B9E\u9645\u4EE5\u8D26\u5355\u4E3A\u51C6\u53CA\u6A21\u578B\u6548\u679C\u4E0D\u540C\u3002\u53C2\u6570\u6539\u53D8\u91CD\u7B97\uFF0C\u8BD5\u7B97\u4E0D\u8C03\u7528\u751F\u6210\u5DE5\u5177\u3001\u4E0D\u8981\u6C42\u767B\u5F55\u6216\u989D\u5916\u5BA1\u6279\u3001\u4E0D\u66FF\u4EE3\u4E24\u9053\u786E\u8BA4\uFF1B\u5DE5\u5177\u62D2\u7EDD\u6216\u7F3A\u5C11\u53EF\u9760\u4EF7\u76EE\u65F6\u8BF4\u660E\u65E0\u6CD5\u53EF\u9760\u4F30\u7B97\u5E76\u6838\u5BF9\u4F9D\u636E\uFF0C\u7981\u6B62\u731C\u4EF7\u6216\u663E\u793A0\u5143\u3002\u5F53\u524D\u6BCF\u6B21\u751F\u6210\u5BA1\u6279\u53EF\u80FD\u53EA\u4F30\u672C\u6B21\u4E00\u6BB5\uFF0C\u4E0D\u80FD\u5192\u5145\u5168\u7247\u9884\u7B97\u3002",
    "\xB7 \u811A\u672C\u5C55\u793A\u662F\u5BA1\u6838\u7684\u5F3A\u5236\u524D\u7F6E\uFF1A\u9996\u6B21\u548C\u6BCF\u6B21\u6539\u7A3F\u5148\u4FDD\u5B58\u672C\u7248\u5B8C\u6574script.md\uFF08\u72B6\u6001\u4E3A\u8349\u7A3F\u3001\u6CE8\u660E\u7248\u672C\uFF09\uFF0C\u518D\u5728\u7528\u6237\u53EF\u89C1\u6B63\u6587\u5C55\u793A\u6545\u4E8B\u3001\u89C4\u683C/\u98CE\u683C\u3001\u4EBA\u7269\u6216\u4E3B\u4F53\u3001\u5206\u955C\u65F6\u95F4\u8868\u3001\u5B8C\u6574\u5BF9\u767D/\u58F0\u97F3\u4E0E\u7ED3\u5C3E\uFF1B\u53EA\u5199\u6587\u4EF6\u3001\u7ED9\u8DEF\u5F84\u3001\u6458\u8981\u3001\u4FEE\u6539\u70B9\u6216\u793A\u610F\u56FE\u4E0D\u7B97\u5C55\u793A\u3002\u6709present/\u6587\u4EF6\u5C55\u793A\u5DE5\u5177\u65F6\u53E6\u884C\u5C55\u793A\u672C\u7248script.md\uFF0C\u7B49\u5F85\u8C03\u7528\u5B8C\u6210\u540E\u624D\u8C03\u7528\u5BA1\u6838\u63D0\u95EE\u5DE5\u5177\uFF0C\u7981\u6B62\u5E76\u884C\u6216\u540C\u4E00\u5DE5\u5177\u6279\u6B21\u540C\u65F6\u53D1\u51FA\u3002\u5C55\u793A\u5931\u8D25\u3001\u4E0D\u652F\u6301Markdown\u6216\u5DE5\u5177\u7F3A\u5931\u65F6\uFF0C\u5148\u5728\u6B63\u6587\u5B8C\u6574\u8D34\u51FA\u811A\u672C\uFF0C\u518D\u63D0\u95EE\u3002\u5BA1\u6838\u7A97\u53E3\u53EA\u7528\u4E8E\u7B80\u77ED\u786E\u8BA4\uFF0C\u7981\u6B62\u628A\u5B8C\u6574\u811A\u672C\u653E\u5165question\u3001header\u3001\u9009\u9879\u6216\u9009\u9879\u63CF\u8FF0\uFF1B\u811A\u672C\u4E0E\u793A\u610F\u56FE\u5148\u5728\u7A97\u53E3\u5916\u5B8C\u6574\u5C55\u793A\uFF0C\u7B49\u5F85\u5B8C\u6210\u518D\u63D0\u95EE\u3002\u5DF2\u5F39\u7A97\u5374\u6F0F\u5C55\u793A\u65F6\uFF0C\u5148\u8865\u5B8C\u6574\u811A\u672C\u5E76\u91CD\u65B0\u5BA1\u6838\uFF0C\u4E0D\u6CBF\u7528\u8BE5\u6B21\u7B54\u590D\uFF0C\u4E0D\u8FDB\u5165\u5236\u4F5C\u786E\u8BA4\u6216\u751F\u6210\u3002",
    "\xB7 \u811A\u672Cscript.md\u7684\u5143\u4FE1\u606F\u7EDF\u4E00\u7528\u4E2D\u6587\uFF1A\u7248\u672C\uFF08\u7B2C1\u7248\u3001\u7B2C2\u7248\uFF09\u3001\u72B6\u6001\uFF08\u8349\u7A3F/\u5DF2\u5BA1\u6838/\u5DF2\u786E\u8BA4\u5236\u4F5C\uFF09\u3001\u5BA1\u6838\u65F6\u95F4\u3001\u5BA1\u6838\u4EBA\u3001\u5236\u4F5C\u786E\u8BA4\u65F6\u95F4\u3001\u5236\u4F5C\u786E\u8BA4\u4EBA\uFF1B\u786E\u8BA4\u4EBA\u586B\u201C\u7528\u6237\u201D\uFF0C\u672A\u786E\u8BA4\u7684\u65F6\u95F4\u548C\u4EBA\u5458\u7559\u7A7A\u3002\u6539\u7A3F\u9000\u56DE\u8349\u7A3F\uFF0C\u6E05\u7A7A\u5BA1\u6838\u4E0E\u5236\u4F5C\u786E\u8BA4\u7684\u65F6\u95F4\u53CA\u4EBA\u5458\u3002\u8BFB\u53D6\u65E7\u811A\u672C\u65F6\u8BC6\u522B\u539F\u82F1\u6587\u5143\u4FE1\u606F\u5E76\u5728\u4E0B\u6B21\u4FDD\u5B58\u65F6\u8F6C\u6362\u4E3A\u4E2D\u6587\uFF0C\u4E0D\u6539\u53D8\u65E2\u6709\u786E\u8BA4\u4E8B\u5B9E\u3002\u6B64\u7EA6\u5B9A\u4EC5\u7528\u4E8E\u7528\u6237\u53EF\u89C1\u811A\u672C\uFF0C\u4E0D\u4FEE\u6539\u5DE5\u5177\u6216\u63A5\u53E3\u7684JSON\u5B57\u6BB5\u3002",
    "\xB7 \u811A\u672C\u5BA1\u6838\u6807\u9898\u987B\u6982\u62EC\u5F53\u524D\u811A\u672C\u4E3B\u9898\uFF0C\u5728\u7A97\u53E3\u5916\u4F7F\u7528\u7B80\u77ED\u4E3B\u9898\u540D\uFF1B\u7A97\u53E3header\u4E0D\u8D85\u8FC712\u4E2A\u6C49\u5B57\uFF0C\u4F8B\u5982\u201C\u96E8\u591C\u91CD\u9022\xB7\u7B2C2\u7248\u201D\uFF1B\u7981\u6B62\u76F4\u63A5\u4F7F\u7528\u6216\u62FC\u63A5\u7528\u6237\u8F93\u5165\u7684\u5B8C\u6574\u5185\u5BB9\u3002\u6807\u9898\u4EC5\u4F5C\u6982\u62EC\uFF0C\u4E0D\u6539\u52A8\u65B9\u6848\uFF1B\u5B8C\u6574\u811A\u672C\u653E\u5728\u7A97\u53E3\u5916\u7684\u4F1A\u8BDD\u6B63\u6587\u548C\u72EC\u7ACB\u6587\u4EF6\u4E2D\uFF0C\u4ECD\u987B\u5148\u5B8C\u6574\u5C55\u793A\u518D\u5BA1\u6838\u3002\u63D0\u95EE\u5DE5\u5177\u6807\u9898\u957F\u5EA6\u53D7\u9650\u65F6\uFF0C\u7F29\u77ED\u4E3B\u9898\u6216\u4F7F\u7528\u201C\u7B2CN\u7248\u811A\u672C\u5BA1\u6838\u201D\uFF0C\u4E0D\u8981\u622A\u53D6\u957F\u8F93\u5165\u5145\u5F53\u6807\u9898\u3002",
    "\xB7 \u5BA1\u6838\u63D0\u95EE\u6BCF\u6B21\u4EC5\u521B\u5EFA\u4E00\u4E2A\u95EE\u9898\uFF0Cheader\u4E0D\u8D85\u8FC712\u4E2A\u6C49\u5B57\uFF08\u5982\u201C\u9E66\u9E49\u5B66\u95E8\u94C3\xB7\u7B2C1\u7248\u201D\uFF0C\u8FC7\u957F\u5C31\u7528\u201C\u7B2C1\u7248\u811A\u672C\u5BA1\u6838\u201D\uFF09\uFF1Bquestion\u53EA\u5199\u4E00\u53E5\u201C\u8FD9\u7248\u811A\u672C\u53EF\u4EE5\u5417\uFF1F\u901A\u8FC7\u540E\u518D\u786E\u8BA4\u662F\u5426\u5236\u4F5C\u3002\u201D\uFF0C\u4E0D\u8D85\u8FC760\u5B57\u3002\u4E24\u4E2A\u9009\u9879\u4E3A\u201C\u8FD9\u7248\u53EF\u4EE5\uFF0C\u8FDB\u5165\u4E0B\u4E00\u6B65\u201D\u548C\u201C\u5148\u4FEE\u6539\uFF0C\u518D\u5BA1\u6838\u201D\uFF0C\u9009\u9879\u63CF\u8FF0\u5982\u9700\u586B\u5199\u4EC5\u7528\u7B80\u77ED\u8BF4\u660E\u3002\u4E0D\u5F97\u628A\u6545\u4E8B\u3001\u89C4\u683C\u3001\u5206\u955C\u3001\u53F0\u8BCD\u62C6\u6210\u591A\u4E2A\u5BA1\u6838\u95EE\u9898\uFF1B\u4E0D\u5F97\u62FC\u63A5\u6574\u7BC7\u811A\u672C\u6216\u7528\u5B57\u9762\u53CD\u659C\u6760n\u4EE3\u66FF\u6B63\u6587\u771F\u5B9E\u6362\u884C\u3002\u4E3B\u9898\u6982\u62EC\u653E\u5728\u7A97\u53E3\u5916\u7684\u811A\u672C\u6807\u9898\u4E2D\u3002\u5236\u4F5C\u786E\u8BA4\u53E6\u8D77\u4E00\u6B21\u63D0\u95EE\uFF0C\u4ECD\u4FDD\u7559\u4E24\u9053\u786E\u8BA4\u3002",
    "\xB7 \u4FEE\u6539\u65B9\u5411\u786E\u8BA4\uFF1A\u7528\u6237\u5DF2\u660E\u786E\u8BF4\u51FA\u4FEE\u6539\u8981\u6C42\u65F6\u76F4\u63A5\u6309\u8981\u6C42\u6539\u7A3F\uFF0C\u4E0D\u518D\u5F39\u65B9\u5411\u9009\u62E9\u3002\u4EC5\u201C\u4FEE\u6539\u4E00\u4E0B\u201D\u7B49\u65B9\u5411\u4E0D\u660E\u786E\u65F6\uFF0C\u624D\u95EE\u4E00\u4E2A\u7B80\u77ED\u95EE\u9898\uFF0C\u9ED8\u8BA4\u63D0\u4F9B2\u20133\u4E2A\u4E92\u65A5\u7684\u5355\u9009\u65B9\u5411\uFF08multi_select\u4E3Afalse\u6216\u7701\u7565\uFF09\uFF0C\u9009\u9879\u6807\u7B7E\u4E0D\u8D85\u8FC712\u4E2A\u6C49\u5B57\u3001\u63CF\u8FF0\u4E0D\u8D85\u8FC7\u4E00\u884C\uFF1B\u4E0D\u9ED8\u8BA4\u7ED9\u51FA5\u9879\u591A\u9009\uFF0C\u4E0D\u6DFB\u52A0\u201C\u6211\u81EA\u5DF1\u8BF4\u201D\u7B49\u7A7A\u64CD\u4F5C\u9009\u9879\uFF0C\u81EA\u7531\u8F93\u5165\u7531\u5BBF\u4E3B\u63D0\u4F9B\u3002\u63D0\u95EE\u4E2D\u7B80\u77ED\u63D0\u793A\u201C\u9009\u597D\u540E\u70B9\u51FB\u63D0\u4EA4\uFF0C\u4E5F\u53EF\u76F4\u63A5\u8F93\u5165\u4FEE\u6539\u8981\u6C42\u201D\u3002\u53EA\u6709\u7528\u6237\u660E\u786E\u8981\u7EC4\u5408\u591A\u4E2A\u65B9\u5411\u65F6\u624D\u4F7F\u7528\u591A\u9009\uFF0C\u5E76\u8BF4\u660E\u201C\u53EF\u591A\u9009\uFF0C\u9009\u5B8C\u70B9\u51FB\u63D0\u4EA4\u201D\uFF1B\u65B9\u5411\u7B54\u590D\u53EA\u662F\u6539\u7A3F\u8981\u6C42\uFF0C\u4E0D\u7B49\u4E8E\u811A\u672C\u5BA1\u6838\u6216\u5236\u4F5C\u6388\u6743\u3002",
    "\xB7 \u811A\u672C\u5BA1\u6838\u4E0E\u5236\u4F5C\u786E\u8BA4\u5728\u63D0\u95EE\u5DE5\u5177\u53EF\u7528\u65F6\u5FC5\u987B\u5B9E\u9645\u8C03\u7528 ask_user_question\uFF08\u6309\u4F1A\u8BDD\u5B9E\u9645\u540D\u79F0\uFF09\u5F39\u51FA\u4EA4\u4E92\u7A97\u53E3\uFF0C\u6B63\u6587\u95EE\u53E5\u4E0D\u80FD\u4EE3\u66FF\u3002\u9996\u6B21\u53CA\u6BCF\u6B21\u6539\u7A3F\u90FD\u8981\uFF1A\u9000\u56DE\u8349\u7A3F\u5E76\u6E05\u7A7A\u65E7\u5BA1\u6838/\u5236\u4F5C\u540C\u610F \u2192 \u4FEE\u6539\u5E76\u5C55\u793A\u4FEE\u6539\u70B9\u4E0E\u5B8C\u6574\u5F53\u524D\u7248\u811A\u672C \u2192 \u540C\u4E00\u8F6E\u91CD\u65B0\u8C03\u7528\u63D0\u95EE\u5DE5\u5177\uFF0C\u521B\u5EFA\u201C\u7B2CN\u7248\u811A\u672C\u5BA1\u6838\u201D\u65B0\u95EE\u9898\uFF08\u5982script_review_v2\uFF09\uFF0C\u9009\u9879\u201C\u8FD9\u7248\u811A\u672C\u53EF\u4EE5\uFF0C\u8FDB\u5165\u4E0B\u4E00\u6B65 / \u5148\u6539\u4E00\u4E0B\uFF0C\u6211\u518D\u770B\u770B\u201D\u3002\u4E0D\u590D\u7528\u65E7\u7B54\u6848\uFF0C\u4E0D\u56E0\u6539\u52A8\u5C0F\u3001\u5DF2\u5F39\u8FC7\u4E00\u6B21\u6216\u7528\u6237\u5728\u804A\u5929\u63D0\u4FEE\u6539\u610F\u89C1\u800C\u7701\u7565\u7A97\u53E3\u3002\u5F53\u524D\u7248\u660E\u786E\u901A\u8FC7\u540E\u624D\u5355\u72EC\u5F39\u8D39\u7528\u4E0E\u5236\u4F5C\u786E\u8BA4\uFF1B\u4FEE\u6539\u610F\u89C1\u3001\u65E7\u7248\u901A\u8FC7\u3001\u672A\u7B54\u3001\u8DF3\u8FC7\u3001\u53D6\u6D88\u3001\u8D85\u65F6\u3001pending\u90FD\u4E0D\u662F\u901A\u8FC7\u3002\u5DE5\u5177\u652F\u6301timeout\u65F6\u7528-1\u7B49\u5F85\u660E\u786E\u56DE\u7B54\u3002\u53EA\u6709\u63D0\u95EE\u5DE5\u5177\u786E\u5B9E\u4E0D\u5B58\u5728\u6216\u660E\u786E\u62A5\u9519\u4E0D\u53EF\u7528\u624D\u56DE\u9000\u6587\u5B57\u5BA1\u6838\uFF0C\u7ED3\u675F\u672C\u8F6E\u7B49\u56DE\u590D\u3002",
    `\xB7 \u65B0\u89C6\u9891\u7528 video_generate\uFF0Cduration \u4F20\u76EE\u6807\u603B\u79D2\u6570\u3002**\u786C\u89C4\u5219\uFF1A\u603B\u65F6\u957F \u2264 ${singleMax} \u79D2\uFF08\u5355\u6BB5\u4E0A\u9650\uFF09\u7684\u6574\u6761\u89C6\u9891\u5FC5\u987B\u4E00\u6B21\u76F4\u51FA\uFF0C\u7981\u6B62\u6309\u53D9\u4E8B\u955C\u5934\u62C6\u6210\u591A\u6B21 video_generate \u518D\u62FC\u63A5**\u2014\u2014\u4F8B\u5982\u300C15 \u79D2\u300D\u5C31\u662F\u4E00\u6B21 15 \u79D2\uFF0C\u4E0D\u8BB8\u62C6\u6210 8+7\uFF1B\u6309\u6545\u4E8B\u9009\u62E9\u4E00\u955C\u5230\u5E95\u6216\u5C11\u91CF\u6709\u52A8\u673A\u7684\u5207\u955C\uFF0C\u955C\u5934\u65B9\u6848\u5148\u5199\u8FDB\u5F85\u5BA1\u6838\u811A\u672C\uFF0C\u5DF2\u5BA1\u6838\u7684\u5207\u955C\u5728\u540C\u4E00\u6B21\u751F\u6210\u63D0\u793A\u8BCD\u4E2D\u5B89\u6392\uFF1B\u7528\u6237\u6307\u5B9A\u7684\u955C\u5934\u5F62\u5F0F\u4F18\u5148\u3002\u8D85\u8FC7\u4E0A\u9650\u65F6\uFF08\u5982 20 \u79D2\uFF09\u4F1A\u81EA\u52A8\u62C6\u6210\u9996\u6BB5 + \u82E5\u5E72\u7EED\u62CD\u6BB5\u518D\u5408\u5E76\u2014\u2014\u90A3\u662F\u540C\u4E00\u6761\u89C6\u9891\u5F80\u4E0B\u7EED\u62CD\uFF0C\u4E0D\u662F\u591A\u955C\u62FC\u63A5\u3002\u6240\u4EE5\u300C20 \u79D2\u89C6\u9891\u300D\u76F4\u63A5\u4F20 duration=20\uFF0C\u4E0D\u7528\u62C6\u6210\u591A\u4E2A\u4EFB\u52A1\uFF0C\u4E5F\u4E0D\u7528\u8DDF\u7528\u6237\u89E3\u91CA\u300C\u6A21\u578B\u4E00\u6B21\u53EA\u80FD\u51FA 15 \u79D2\u300D\uFF1B**\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\u7684\u6210\u7247\u662F\u300C\u5FAA\u73AF\u8FED\u4EE3\u300D\u7684\uFF1A\u6BCF\u6BB5\u751F\u6210\u5B8C\u5148\u8FD4\u56DE\u89C6\u9891\u6210\u679C\u4F9B\u5C55\u793A\uFF0C\u7528\u6237\u9884\u89C8\u5E76\u786E\u8BA4\u540E\u518D\u7528 resume \u7EE7\u7EED\uFF0C\u4E0D\u8981\u7ED5\u8FC7\u5B83\u3001\u4E5F\u4E0D\u8981\u81EA\u5DF1\u62C6\u6210\u591A\u6B21\u751F\u6210**\uFF1B\u5206\u6BB5\u4EA4\u4ED8\u65F6\u7ED3\u679C\u91CC\u5E26 paused=true\u3001resumeDir\u3001remainingSeconds\u2014\u2014\u8FD9\u65F6\u5148\u628A\u5DF2\u7ECF\u751F\u6210\u7684\u90E8\u5206\u4EA4\u4ED8\u7ED9\u4ED6\uFF0C\u7B49\u4ED6\u8BF4\u300C\u7EE7\u7EED\u300D\u518D\u628A resumeDir \u539F\u6837\u4F20\u7ED9 video_generate \u7684 resume \u53C2\u6570\uFF08\u63D2\u4EF6\u63A5\u7740\u5DF2\u6709\u7684\u5206\u6BB5\u5F80\u4E0B\u505A\uFF0C\u524D\u9762\u51E0\u6BB5\u4E0D\u91CD\u65B0\u751F\u6210\u3001\u4E0D\u91CD\u590D\u6263\u8D39\uFF09\uFF0C\u4E0D\u8981\u4ECE\u5934\u518D\u6765\u4E00\u904D\uFF1B\u540C\u4E00\u4EFD\u6682\u505C\u8FDB\u5EA6\uFF08resumeDir\uFF09\u540C\u4E00\u65F6\u95F4\u53EA\u5141\u8BB8\u4E00\u6B21 resume \u5728\u8DD1\uFF1A\u5982\u679C\u7ED3\u679C\u8BF4\u300C\u5DF2\u7ECF\u6709\u4E00\u6B21\u300E\u7EE7\u7EED\u300F\u5728\u8DD1\u300D\uFF0C\u5C31\u8BA9\u7528\u6237\u7B49\u90A3\u4E00\u6B21\u8DD1\u5B8C\uFF08\u6216\u786E\u8BA4\u5B83\u5DF2\u4E2D\u65AD\u3001\u9501\u8FC7\u671F\uFF09\u518D\u7EE7\u7EED\uFF0C\u4E0D\u8981\u91CD\u590D\u53D1 resume\u2014\u2014\u91CD\u590D\u4F1A\u628A\u5269\u4E0B\u7684\u6BB5\u63D0\u4EA4\u4E24\u904D\u3001\u91CD\u590D\u6263\u8D39\uFF1B\u7528\u6237\u4E2D\u9014\u70B9\u4E86\u300C\u505C\u6B62\u300D\u6216\u8FD9\u4E00\u8F6E\u7B49\u8D85\u65F6\u4E5F\u4E00\u6837\uFF1A\u5DF2\u7ECF\u751F\u6210\u597D\u7684\u6BB5\u4F1A\u5148\u4E0B\u8F7D\u3001\u5408\u5E76\u3001\u4EA4\u4ED8\uFF08\u7ED3\u679C\u91CC\u540C\u6837\u662F paused=true + \u6210\u7247 + resumeDir\uFF09\uFF0C\u4E0D\u8981\u628A\u90A3\u51E0\u6BB5\u4E22\u6389\u91CD\u6765\uFF1B\u5355\u6761\u6210\u7247\u6700\u957F ${MAX_TOTAL_SECONDS} \u79D2\uFF08\u6700\u591A ${MAX_SEGMENTS} \u6BB5\uFF09\uFF0C\u7528\u6237\u8981\u66F4\u957F\u7684\u5C31\u6309 ${MAX_TOTAL_SECONDS} \u79D2\u751F\u6210\u5E76\u8BF4\u660E\u8FD9\u662F\u63D2\u4EF6\u5F53\u524D\u7684\u4E0A\u9650\uFF0C\u4E0D\u8981\u53CD\u590D\u52A0\u5927 duration\uFF1B\u6210\u7247\u9ED8\u8BA4\u843D\u5728\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/\u3002`,
    "\xB7 \u7ED9\u5DF2\u6709\u89C6\u9891\u63A5\u957F\u7528 video_extend\uFF0C\u8F93\u5165\u5FC5\u987B\u662F\u516C\u7F51 URL\uFF1B\u63D0\u793A\u8BCD\u4EE5\u300C\u5411\u540E\u5EF6\u957F\u89C6\u98911\u300D\u6216\u300C\u5411\u524D\u5EF6\u957F\u89C6\u98911\u300D\u5F00\u5934\uFF0C\u5168\u7A0B\u7528\u300C\u89C6\u98911\u300D\u6307\u4EE3\u7D20\u6750\uFF0C\u4E0D\u8981\u5199\u300C\u53C2\u8003\u89C6\u98911\u300D\uFF1B\u5199\u6E05\u5EF6\u957F\u65B9\u5411\u3001\u5267\u60C5\u53D1\u5C55\u3001\u4E3B\u4F53\u72B6\u6001\u3001\u955C\u5934\u8FD0\u52A8\u3001\u58F0\u97F3\u5EF6\u7EED\uFF08\u80CC\u666F\u97F3\u4E50\u63A5\u5728\u89C6\u98911\u7ED3\u5C3E\u5904\u3001\u4E0D\u8981\u4ECE\u5934\u64AD\u653E\uFF0C\u73AF\u5883\u58F0\u548C\u5BF9\u767D\u4E5F\u8981\u8FDE\u7EED\uFF09\uFF1B\u6BCF\u6BB5 4 \u81F3\u6A21\u578B\u4E0A\u9650\uFF082.0 \u4E3A 15\u30012.5 \u4E3A 30\uFF09 \u79D2\uFF0C\u9ED8\u8BA4\u6309\u4E0A\u9650\u62C6\u3001\u6BB5\u6570\u6700\u5C11\uFF1B\u8FDE\u7740\u5EF6\u957F\u591A\u6BB5\u65F6\u6BCF\u6BB5\u5B8C\u6210\u5148\u4EA4\u4ED8\u9884\u89C8\uFF0C\u7528\u6237\u786E\u8BA4\u540E\u7528 resume \u7EE7\u7EED\uFF0C\u5E76\u9ED8\u8BA4\u4E0B\u8F7D\u5206\u6BB5\u5728\u672C\u673A\u5408\u5E76\u6210\u4E00\u6761\u6210\u7247\uFF08\u7F3A ffmpeg \u4F1A\u5148\u62E6\u4E0B\u6765\u95EE\uFF09\uFF1B\u7528\u6237\u70B9\u300C\u62D2\u7EDD\u300D\u6216\u4E2D\u9014\u88AB\u505C\u6B62\u65F6\uFF0C\u5DF2\u7ECF\u5EF6\u957F\u597D\u7684\u90E8\u5206\u7167\u6837\u5148\u4EA4\u4ED8\uFF08paused=true + resumeDir\uFF09\uFF0C\u4E4B\u540E\u628A resumeDir \u4F20\u7ED9 video_extend \u7684 resume \u53C2\u6570\u63A5\u7740\u505A\u5373\u53EF\uFF0C\u4E0D\u91CD\u590D\u751F\u6210\u3001\u4E0D\u91CD\u590D\u6263\u8D39\u3002",
    "\xB7 \u751F\u6210\u901A\u5E38\u8981\u51E0\u5206\u949F\uFF1A\u5355\u6B21\u8C03\u7528\u8FD4\u56DE timeout \u4E0D\u7B49\u4E8E\u5931\u8D25\uFF0C\u4F18\u5148\u7528\u539F\u5DE5\u5177\u52A0 resume \u67E5\u8BE2\u5E76\u63A5\u56DE\u8FDB\u5EA6\uFF0C\u4E5F\u53EF\u7528 video_status \u52A0 taskId \u7EE7\u7EED\u67E5\uFF08\u4E0A\u6E38\u94FE\u63A5\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u540C\u4E00\u6BB5\u3002\u4E0B\u8F7D\u6216\u5408\u5E76\u5931\u8D25\u65F6\u4F7F\u7528\u539Fresume\u91CD\u8BD5\u4EA4\u4ED8\uFF0C\u4E0D\u65B0\u5EFA\u751F\u6210\u4EFB\u52A1\u3002\u6A21\u578B\u6216\u63A5\u5165\u6E20\u9053\u53D8\u5316\u65F6\u5148\u8BF4\u660E\u5E76\u53D6\u5F97\u7528\u6237\u660E\u786E\u786E\u8BA4\uFF0C\u624D\u4F20resumeWithCurrentConfig:true\uFF1B\u8FD8\u6709\u5F85\u67E5\u8BE2\u4EFB\u52A1\u65F6\u5FC5\u987B\u6062\u590D\u539F\u914D\u7F6E\u3002",
    "\xB7 \u73AF\u5883\u6709\u95EE\u9898\uFF08\u7F3A ffmpeg \u88C5\u4E0D\u4E0A\u3001\u60F3\u786E\u8BA4\u80FD\u4E0D\u80FD\u5408\u5E76\uFF09\u7528 video_setup\uFF1A\u9ED8\u8BA4\u53EA\u68C0\u67E5\uFF0Cinstall:true \u624D\u4F1A\u771F\u88C5\uFF1B\u88C5\u547D\u4EE4\u4F1A\u5148\u7ED9\u7528\u6237\u786E\u8BA4\uFF0C\u88C5\u5B8C\u81EA\u52A8\u9A8C\u8BC1\u3002\u7528\u6237\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u65F6\u5C31\u7528\u5B83\uFF0C\u522B\u81EA\u5DF1\u62FC\u547D\u4EE4\u884C\u3002",
    "\xB7 \u6362\u6A21\u578B\u3001\u65F6\u957F\u7B49\u914D\u7F6E\u7528 video_config\uFF08\u5199\u8FDB profile\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u540E\u751F\u6548\uFF09\uFF1B\u4F46 A \u670D\u52A1\u7AEF\u6A21\u5F0F\u7684 apiKey \u4F8B\u5916\uFF1A\u5B83\u53EA\u80FD\u7531\u670D\u52A1\u7AEF\u5728\u300C\u767B\u5F55\u300D\u65F6\u4E0B\u53D1\uFF0C\u4E0D\u8981\u624B\u586B\u3001\u4E5F\u4E0D\u8981\u8BA9\u7528\u6237\u624B\u586B\uFF0C\u7F3A Key \u6216\u63D0\u793A\u300C\u4E0D\u662F\u670D\u52A1\u7AEF\u4E0B\u53D1\u7684\u300D\u65F6\uFF0C\u5C31\u5F15\u5BFC\u7528\u6237\u53BB\u63D2\u4EF6\u8BE6\u60C5\u9875\u70B9\u300C\u767B\u5F55\u300D\u3002\u957F\u89C6\u9891\u8981\u5728\u672C\u673A\u5408\u5E76\uFF0C\u9700\u8981 ffmpeg\uFF1A\u672C\u673A\u6CA1\u88C5\u65F6\uFF0C\u63D2\u4EF6\u4F1A\u5148\u628A\u8FD9\u6B21\u751F\u6210\u62E6\u56DE\u6765\uFF08\u4E0D\u4EA7\u751F\u8D39\u7528\uFF09\uFF0C\u8FD9\u65F6\u8981\u5728\u5BF9\u8BDD\u6846\u91CC\u95EE\u7528\u6237\u300C\u8981\u4E0D\u8981\u6388\u6743\u6211\u88C5 ffmpeg\u300D\u2014\u2014\u6309\u8FD4\u56DE\u7684\u8BF4\u660E\u8BF4\u6E05\u4ED6\u7684\u7CFB\u7EDF\u4E0E\u547D\u4EE4\uFF0C\u7528\u6237\u540C\u610F\u5C31\u8C03\u7528 video_setup\uFF08install:true\uFF09\u7531\u63D2\u4EF6\u6765\u88C5\uFF08\u5BBF\u4E3B\u4F1A\u5148\u8BA9\u4ED6\u786E\u8BA4\u90A3\u6761\u547D\u4EE4\uFF09\uFF0C\u88C5\u5B8C\u5B83\u4F1A\u81EA\u5DF1\u9A8C\u8BC1\uFF0C\u518D\u6309\u539F duration \u91CD\u53D1\uFF1B\u7528\u6237\u4E0D\u60F3\u88C5\u5C31\u5E26 merge:false \u91CD\u53D1\uFF0C\u63D2\u4EF6\u53EA\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF08\u6BCF\u6BB5\u94FE\u63A5 + \u672C\u5730\u6587\u4EF6\uFF09\uFF0C\u7ED3\u679C\u91CC\u4F1A\u5E26 ffmpegMissing=true \u4E0E installHint\uFF0C\u7167\u5B83\u5F15\u5BFC\u5B89\u88C5\u5373\u53EF\u3002",
    `\xB7 \u5F53\u524D\u914D\u7F6E\uFF1A\u76F4\u51FA\u4E0A\u9650 ${singleMax} \u79D2\u3001\u6BCF\u6BB5\u5EF6\u957F ${segmentSeconds} \u79D2\u3002`,
    "\xB7 \u4EC5 A \u670D\u52A1\u7AEF\u6A21\u5F0F\u6CA1\u6709 API Key \u65F6\uFF1A\u8BA9\u7528\u6237\u5728\u63D2\u4EF6\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D\uFF0C\u7528\u90AE\u7BB1\u6536\u9A8C\u8BC1\u7801\u9886\u4E00\u628A\uFF08\u4E00\u4E2A\u90AE\u7BB1\u53EA\u53D1\u4E00\u628A\uFF0C\u9ED8\u8BA4\u989D\u5EA6 \xA50.01\uFF09\uFF0C\u6210\u529F\u540E\u4E0A\u6E38 / Key / \u5730\u5740 / \u6A21\u578B\u4F1A\u81EA\u52A8\u586B\u597D\uFF1B\u8BBE\u7F6E\u9875\u8FD8\u80FD\u770B\u5230\u8FD9\u628A Key \u7684\u5269\u4F59 / \u5DF2\u7528\u989D\u5EA6\u548C\u6700\u8FD1\u51E0\u6B21\u51FA\u7247\u7684\u4F7F\u7528\u8BB0\u5F55\u3002"
  ].join("\n");
}

// src/index.ts
init_config();

// src/internal/update-lockfile.ts
import { existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path13 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var PACKAGE_NAME = "metaontic-video";
var LOCKFILE = "pnpm-lock.yaml";
var RELEASE_URL = /^https?:\/\/(?:gitee\.com\/hackloop|github\.com\/wxsimon2022)\/metaontic-video\/releases\/download\//i;
var SHA = /^sha\d+-[A-Za-z0-9+/=]+$/;
var indentOf = (line) => line.length - line.trimStart().length;
function integrityOf(block) {
  const match = /integrity:\s*([^,\s}]+)/.exec(block);
  return match ? match[1] : "";
}
function remoteEntry(line) {
  const match = /^ {2}(\S+)@(https?:\/\/\S+?):(?:\s.*)?$/.exec(line);
  return match ? { name: match[1], url: match[2] } : null;
}
function blockEnd(lines, start, indent) {
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (!line.trim()) {
      end += 1;
      continue;
    }
    if (indentOf(line) <= indent) break;
    end += 1;
  }
  return end;
}
function stripUnverifiableEntries(text) {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const ours = /* @__PURE__ */ new Set();
  const verified = /* @__PURE__ */ new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const entry = remoteEntry(lines[index]);
    if (!entry || entry.name !== PACKAGE_NAME) continue;
    const end = blockEnd(lines, index, 2);
    const block = lines.slice(index, end).join("\n");
    if (!RELEASE_URL.test(entry.url) && !/tarball:\s*https?:\/\//.test(block)) continue;
    ours.add(entry.url);
    if (SHA.test(integrityOf(block))) verified.add(entry.url);
  }
  const poisoned = new Set([...ours].filter((url) => !verified.has(url)));
  if (!poisoned.size) return { text, removed: [] };
  const removed = /* @__PURE__ */ new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const entry = remoteEntry(lines[index]);
    if (!entry || entry.name !== PACKAGE_NAME || !poisoned.has(entry.url)) continue;
    const end = blockEnd(lines, index, 2);
    removed.add(entry.name + "@" + entry.url);
    lines.splice(index, end - index);
    index -= 1;
  }
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^ {6}metaontic-video:\s*$/.test(lines[index])) continue;
    const specifier = (/^\s+specifier:\s*(\S+)\s*$/.exec(lines[index + 1] || "") || [])[1] || (/^\s+version:\s*(\S+)\s*$/.exec(lines[index + 2] || "") || [])[1] || "";
    if (!poisoned.has(specifier)) continue;
    lines.splice(index, blockEnd(lines, index, 6) - index);
    index -= 1;
  }
  return { text: lines.join(newline), removed: [...removed] };
}
function locateProfileDir(moduleUrl) {
  let dir = fileURLToPath2(moduleUrl);
  for (let up = 0; up < 3; up += 1) dir = path13.dirname(dir);
  return dir;
}
function repairLockfileAt(lockfile, log = () => {
}) {
  if (!existsSync(lockfile)) return { status: "unavailable" };
  let before = "";
  try {
    before = readFileSync(lockfile, "utf8");
  } catch {
    return { status: "unavailable" };
  }
  const { text, removed } = stripUnverifiableEntries(before);
  if (!removed.length) return { status: "clean", lockfile };
  const backup = lockfile + ".metaontic-backup-" + (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const temporary = lockfile + ".metaontic-" + process.pid + ".tmp";
  try {
    writeFileSync(backup, before);
    writeFileSync(temporary, text);
    renameSync(temporary, lockfile);
  } catch (error) {
    try {
      if (existsSync(temporary)) unlinkSync(temporary);
    } catch {
    }
    return { status: "failed", message: error && error.message || String(error) };
  }
  log("\u5DF2\u6E05\u7406 " + removed.length + " \u6761\u7F3A\u5C11 integrity \u7684\u9501\u6587\u4EF6\u8BB0\u5F55\uFF08" + removed.join("\u3001") + "\uFF09\uFF0C\u5907\u4EFD\u5728 " + path13.basename(backup) + "\uFF1B\u4E4B\u540E\u53EF\u4EE5\u5728\u7EBF\u66F4\u65B0\u3002");
  return { status: "repaired", lockfile, backup, removed };
}
function locateLockfiles(dir, depth = 2) {
  const found = [];
  const walk = (current, level) => {
    const candidate = path13.join(current, LOCKFILE);
    try {
      if (existsSync(candidate)) found.push(candidate);
    } catch {
    }
    if (level <= 0) return;
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      walk(path13.join(current, entry.name), level - 1);
    }
  };
  walk(dir, depth);
  return found;
}
function locateStagingLockfiles(profileDir) {
  const parent = path13.dirname(profileDir);
  let entries = [];
  try {
    entries = readdirSync(parent, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/staging/i.test(entry.name)) continue;
    const dir = path13.join(parent, entry.name);
    if (dir === profileDir) continue;
    found.push(...locateLockfiles(dir, 1));
  }
  return found;
}
function updateLockfilesToWatch(profileDir) {
  return [.../* @__PURE__ */ new Set([...locateLockfiles(profileDir), ...locateStagingLockfiles(profileDir)])];
}
function startUpdateLockfileRepair(moduleUrl, intervalMs = 2e3, log) {
  let stopped = false;
  const stamps = /* @__PURE__ */ new Map();
  const check = () => {
    if (stopped) return;
    try {
      const dir = locateProfileDir(moduleUrl);
      if (!existsSync(path13.join(dir, "package.json"))) return;
      for (const lockfile of updateLockfilesToWatch(dir)) {
        let stamp = "";
        try {
          const info = statSync(lockfile);
          stamp = info.mtimeMs + ":" + info.size;
        } catch {
          continue;
        }
        if (stamps.get(lockfile) === stamp) continue;
        stamps.set(lockfile, stamp);
        repairLockfileAt(lockfile, log);
      }
    } catch {
    }
  };
  check();
  const timer = setInterval(check, intervalMs);
  if (timer.unref) timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// src/index.ts
init_connection();
init_config();
var inject = ["tools"];
function asDisposer(value) {
  return typeof value === "function" ? value : void 0;
}
function apply(ctx, config = {}) {
  const deps = {};
  const storyboardReview = createStoryboardReviewGuard();
  const deliveryOrder = createDeliveryOrderGuard();
  const storyboardObserver = ctx.on("session/event", storyboardReview.observe);
  const deliveryObserver = ctx.on("session/event", deliveryOrder.observe);
  const scriptObserver = ctx.on("session/event", createScriptTracker().observe);
  const register = (tool) => ctx.tools.register(withStageTiming(tool));
  const disposers = [
    ...typeof storyboardObserver === "function" ? [storyboardObserver] : [],
    ...typeof deliveryObserver === "function" ? [deliveryObserver] : [],
    ...typeof scriptObserver === "function" ? [scriptObserver] : [],
    register(jsonSafeTool(stageTool())),
    register(jsonSafeTool(estimateTool(config))),
    register(jsonSafeTool(submissionTool(config))),
    register(jsonSafeTool(prepareImageTool(config))),
    register(withVideoExecution(withResumeLock(jsonSafeTool(withActualCost(videoTool(config, deps, ctx), config)), "video_generate", config), deliveryOrder.remember)),
    register(withVideoExecution(withResumeLock(jsonSafeTool(withActualCost(extendTool(config, deps, ctx), config)), "video_extend", config), deliveryOrder.remember)),
    register(withVideoExecution(jsonSafeTool(withActualCost(taskTool(config), config)))),
    register(jsonSafeTool(setupTool(config)))
  ];
  try {
    const stopLockfileRepair = startUpdateLockfileRepair(
      import.meta.url,
      void 0,
      (message) => ctx.logger?.warn?.(`metaontic-video: ${message}`)
    );
    if (typeof stopLockfileRepair === "function") disposers.push(stopLockfileRepair);
  } catch (error) {
    ctx.logger?.warn?.(`metaontic-video: \u5B89\u88C5\u76EE\u5F55\u9501\u6587\u4EF6\u81EA\u6108\u672A\u542F\u7528\uFF1A${error?.message || error}`);
  }
  if (process.env.METAONTIC_VIDEO_INTERNAL_HYPERFRAMES === "1") {
    disposers.push(register(jsonSafeTool(hyperframesTool(config, deps))));
  }
  const cleanup = ctx.inject(["settings"], (settingsCtx) => {
    disposers.push(settingsCtx.tools.register(withStageTiming(jsonSafeTool(configTool(config, settingsCtx.settings)))));
  });
  for (const dispose of [asDisposer(cleanup)]) if (dispose) disposers.push(dispose);
  const promptCleanup = ctx.inject(["systemPrompt"], (promptCtx) => promptCtx.systemPrompt.section({
    name: "plugin:metaontic-video",
    order: 5200,
    text: () => buildPromptGuidance(config)
  }));
  for (const dispose of [asDisposer(promptCleanup)]) if (dispose) disposers.push(dispose);
  const workdirCleanup = ctx.inject(["workingDirectory"], (workdirCtx) => {
    deps.workdir = workdirCtx.workingDirectory;
    return () => {
      deps.workdir = void 0;
    };
  });
  for (const dispose of [asDisposer(workdirCleanup)]) if (dispose) disposers.push(dispose);
  let gateCleanup;
  try {
    gateCleanup = ctx.on("tools/pre-execute", async (exec, next) => {
      const storyboardGate = await storyboardReview.gate(exec);
      if (storyboardGate) return storyboardGate;
      const orderGate = await deliveryOrder.gate(exec);
      if (orderGate) return orderGate;
      if (!GATED_TOOLS.includes(exec.name)) return next();
      try {
        return await preflightGate(ctx, config, exec);
      } catch (error) {
        const message = error?.message || String(error);
        if (exec.name === "video_prepare_image") return { kind: "deny", reason: "\u56FE\u7247\u8D39\u7528\u786E\u8BA4\u672A\u80FD\u5B8C\u6210\uFF0C\u8BF7\u5148\u6062\u590D\u786E\u8BA4\u80FD\u529B\uFF1B\u672A\u53D6\u5F97\u540C\u610F\u4E0D\u751F\u6210\u56FE\u7247\u3002" };
        if (exec.name === "video_setup") {
          const command = ffmpegInstallOptions().installs[0].command;
          return {
            kind: "ask",
            reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u51C6\u5907\u6267\u884C\u5B89\u88C5\u547D\u4EE4\u300C${command}\u300D\uFF08\u9884\u68C0\u672C\u8EAB\u51FA\u9519\uFF1A${message}\uFF09\u3002`,
            displayReason: {
              zh: `\u51C6\u5907\u5728\u8FD9\u53F0\u7535\u8111\u4E0A\u88C5 ffmpeg\uFF1A${command}\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u6267\u884C\u3002`,
              en: `About to install ffmpeg on this machine: ${command}. It runs only after you allow it.`
            }
          };
        }
        if (isManualKey(config)) return {
          kind: "ask",
          reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u8C03\u7528${connectionLabel(config)}\uFF08\u9884\u68C0\u5F02\u5E38\uFF1A${message}\uFF09\u3002`,
          displayReason: { zh: `\u672C\u6B21\u901A\u8FC7${connectionLabel(config)}\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF0C\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\u3002\u9884\u68C0\u5F02\u5E38\uFF1A${message}\u3002\u786E\u8BA4\u540E\u7EE7\u7EED\u3002`, en: `Call the video model with actual usage billing. Preflight error: ${message}. Confirm to continue.` }
        };
        return {
          kind: "ask",
          reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF08\u9884\u4F30\u8D39\u7528\u6CA1\u7B97\u51FA\u6765\uFF1A${message}\uFF09\u3002`,
          displayReason: {
            zh: `\u672C\u6B21\u4F1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF0C\u4F46\u9884\u4F30\u8D39\u7528\u6CA1\u7B97\u51FA\u6765\uFF08${message}\uFF09\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u771F\u6B63\u8C03\u7528\u3002`,
            en: "This will call the video model, but the cost estimate failed. The call runs only after you allow it."
          }
        };
      }
    });
  } catch (error) {
    ctx.logger?.warn?.(
      `metaontic-video: \u8C03\u7528\u524D\u7684\u4EBA\u5DE5\u786E\u8BA4\u5361\u53E3\u6CE8\u518C\u5931\u8D25\uFF1A${error?.message || error}`
    );
  }
  if (typeof gateCleanup === "function") disposers.push(gateCleanup);
  return () => {
    for (const dispose of disposers) dispose();
  };
}
export {
  Config,
  apply,
  inject
};
