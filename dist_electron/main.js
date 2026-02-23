var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports2, module2) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module2.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports2, module2) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module2.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports2, module2) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports2 = module2.exports = {};
    var re = exports2.re = [];
    var safeRe = exports2.safeRe = [];
    var src = exports2.src = [];
    var safeSrc = exports2.safeSrc = [];
    var t = exports2.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports2.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports2.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports2.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports2, module2) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module2.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports2, module2) {
    "use strict";
    var numeric = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric.test(a);
      const bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module2.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports2, module2) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var SemVer = class _SemVer {
      constructor(version, options) {
        options = parseOptions(options);
        if (version instanceof _SemVer) {
          if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
            return version;
          } else {
            version = version.version;
          }
        } else if (typeof version !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
        }
        if (version.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version}`);
        }
        this.raw = version;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match || match[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
                if (isNaN(this.prerelease[1])) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module2.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse = (version, options, throwErrors = false) => {
      if (version instanceof SemVer) {
        return version;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module2.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var valid = (version, options) => {
      const v = parse(version, options);
      return v ? v.version : null;
    };
    module2.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module2.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version instanceof SemVer ? version.version : version,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module2.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var diff = (version1, version2) => {
      const v1 = parse(version1, null, true);
      const v2 = parse(version2, null, true);
      const comparison = v1.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v1 : v2;
      const lowVersion = v1Higher ? v2 : v1;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v1.major !== v2.major) {
        return prefix + "major";
      }
      if (v1.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v1.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module2.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module2.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module2.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module2.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module2.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module2.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module2.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module2.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module2.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module2.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module2.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module2.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module2.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module2.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module2.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module2.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module2.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports2, module2) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte = require_gte();
    var lt = require_lt();
    var lte = require_lte();
    var cmp = (a, op, b, loose) => {
      switch (op) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op}`);
      }
    };
    module2.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version, options) => {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      const major = match[2];
      const minor = match[3] || "0";
      const patch = match[4] || "0";
      const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
      const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
      return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module2.exports = coerce;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports2, module2) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module2.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports2, module2) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range = class _Range {
      constructor(range, options) {
        options = parseOptions(options);
        if (range instanceof _Range) {
          if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
            return range;
          } else {
            return new _Range(range.raw, options);
          }
        }
        if (range instanceof Comparator) {
          this.raw = range.value;
          this.set = [[range]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range) {
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range;
        const cached = cache2.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache2.set(memoKey, result);
        return result;
      }
      intersects(range, options) {
        if (!(range instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version) {
        if (!version) {
          return false;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module2.exports = Range;
    var LRU = require_lrucache();
    var cache2 = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports2, module2) {
    "use strict";
    var ANY = /* @__PURE__ */ Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version) {
        debug("Comparator.test", version, this.options.loose);
        if (this.semver === ANY || version === ANY) {
          return true;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module2.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var satisfies = (version, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version);
    };
    module2.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module2.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var maxSatisfying = (versions, range, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module2.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var minSatisfying = (versions, range, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module2.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var gt = require_gt();
    var minVersion = (range, loose) => {
      range = new Range(range, loose);
      let minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    };
    module2.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module2.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range = require_range();
    var satisfies = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte = require_lte();
    var gte = require_gte();
    var outside = (version, range, hilo, options) => {
      version = new SemVer(version, options);
      range = new Range(range, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version, range, options)) {
        return false;
      }
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module2.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var gtr = (version, range, options) => outside(version, range, ">", options);
    module2.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range, options) => outside(version, range, "<", options);
    module2.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module2.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports2, module2) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module2.exports = (versions, range, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version of v) {
        const included = satisfies(version, range, options);
        if (included) {
          prev = version;
          if (!first) {
            first = version;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range.raw === "string" ? range.raw : String(range);
      return simplified.length < original.length ? simplified : range;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range(sub, options);
      dom = new Range(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !satisfies(gt.semver, String(c), options)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !satisfies(lt.semver, String(c), options)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module2.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports2, module2) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse = require_parse();
    var valid = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte = require_gte();
    var lte = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var Comparator = require_comparator();
    var Range = require_range();
    var satisfies = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module2.exports = {
      parse,
      valid,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte,
      lte,
      cmp,
      coerce,
      Comparator,
      Range,
      satisfies,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// node_modules/server-destroy/index.js
var require_server_destroy = __commonJS({
  "node_modules/server-destroy/index.js"(exports2, module2) {
    module2.exports = enableDestroy;
    function enableDestroy(server) {
      var connections = {};
      server.on("connection", function(conn) {
        var key = conn.remoteAddress + ":" + conn.remotePort;
        connections[key] = conn;
        conn.on("close", function() {
          delete connections[key];
        });
      });
      server.destroy = function(cb) {
        server.close(cb);
        for (var key in connections)
          connections[key].destroy();
      };
    }
  }
});

// electron/main.ts
var import_electron8 = require("electron");
var import_path5 = __toESM(require("path"));
var import_fs5 = __toESM(require("fs"));

// electron/updater.ts
var import_electron = require("electron");
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
var import_semver = __toESM(require_semver2());
var LOG_FILE = import_path.default.join(import_electron.app.getPath("userData"), "update.log");
function log(level, ...args) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const platform2 = import_os.default.platform();
  const message = args.map(
    (arg) => typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(" ");
  const logLine = `[${timestamp}] [${platform2}] [${level}] ${message}
`;
  if (level === "ERROR") {
    console.error(`\u{1F534} [UPDATER] ${message}`);
  } else if (level === "WARN") {
    console.warn(`\u{1F7E1} [UPDATER] ${message}`);
  } else {
    console.log(`\u{1F7E2} [UPDATER] ${message}`);
  }
  try {
    import_fs.default.appendFileSync(LOG_FILE, logLine, "utf8");
  } catch (e) {
    console.error("Failed to write to log file:", e);
  }
}
function rotateLogFile() {
  try {
    if (import_fs.default.existsSync(LOG_FILE)) {
      const content = import_fs.default.readFileSync(LOG_FILE, "utf8");
      const lines = content.split("\n");
      if (lines.length > 1e3) {
        import_fs.default.writeFileSync(
          LOG_FILE,
          lines.slice(-500).join("\n"),
          "utf8"
        );
        log("INFO", "Log file rotated (kept last 500 lines)");
      }
    }
  } catch (e) {
    console.error("Failed to rotate log file:", e);
  }
}
function getLogFilePath() {
  return LOG_FILE;
}
function readLogFile() {
  try {
    if (import_fs.default.existsSync(LOG_FILE)) {
      return import_fs.default.readFileSync(LOG_FILE, "utf8");
    }
  } catch (e) {
    console.error("Failed to read log file:", e);
  }
  return "";
}
var S3_BASE_URL = "https://mosaic-release.s3.us-east-2.amazonaws.com";
function getLatestJsonUrl() {
  const appName = import_electron.app.getName();
  const experimentMatch = appName.match(/^mosaic-companion-(.+)$/);
  if (experimentMatch) {
    const experimentName = experimentMatch[1];
    const url = `${S3_BASE_URL}/releases/experimental/${experimentName}/latest.json`;
    log("INFO", `Experimental build detected: ${experimentName}`);
    log("INFO", `Using latest.json URL: ${url}`);
    return url;
  }
  return `${S3_BASE_URL}/releases/latest.json`;
}
function getInstallPageUrl() {
  const appName = import_electron.app.getName();
  const experimentMatch = appName.match(/^mosaic-companion-(.+)$/);
  if (experimentMatch) {
    const experimentName = experimentMatch[1];
    return `${S3_BASE_URL}/releases/experimental/${experimentName}/index.html`;
  }
  return `${S3_BASE_URL}/index.html`;
}
var isLinux = import_os.default.platform() === "linux";
var isManualCheck = false;
var getFeedUrl = () => {
  const platform2 = import_os.default.platform();
  const arch2 = import_os.default.arch();
  if (platform2 === "win32") {
    return `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/win32/${arch2}`;
  } else if (platform2 === "darwin") {
    return `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/${platform2}/${arch2}`;
  }
  return null;
};
function initUpdater() {
  rotateLogFile();
  log("INFO", "========================================");
  log("INFO", "UPDATER INITIALIZATION (NATIVE)");
  log("INFO", "========================================");
  log("INFO", `Platform: ${import_os.default.platform()} (${import_os.default.arch()})`);
  log("INFO", `App Version: ${import_electron.app.getVersion()}`);
  log("INFO", `Log File: ${LOG_FILE}`);
  const feedUrl = getFeedUrl();
  if (feedUrl && !isLinux) {
    try {
      log("INFO", `Configuring feed URL: ${feedUrl}`);
      import_electron.autoUpdater.setFeedURL({ url: feedUrl });
    } catch (e) {
      log("ERROR", "Failed to set feed URL:", e.message);
    }
  } else if (isLinux) {
    log("INFO", "Linux detected: Using manual update check");
  }
  log("INFO", "========================================");
}
function applyAutoDownload(enabled) {
  log("INFO", `applyAutoDownload: ${enabled} (Note: native autoUpdater downloads automatically upon checking)`);
}
function checkForUpdates() {
  if (isLinux) {
    checkForUpdatesLinux(false);
    return;
  }
  log("INFO", "Checking for updates (automatic startup check)...");
  try {
    import_electron.autoUpdater.checkForUpdates();
  } catch (e) {
    log("ERROR", "Failed to check for updates:", e.message);
  }
}
function manualCheckForUpdates() {
  if (isLinux) {
    checkForUpdatesLinux(true);
    return;
  }
  log("INFO", "MANUAL UPDATE CHECK TRIGGERED");
  isManualCheck = true;
  try {
    import_electron.autoUpdater.checkForUpdates();
  } catch (e) {
    log("ERROR", "Failed to check for updates manually:", e.message);
    import_electron.dialog.showMessageBox({
      type: "error",
      title: "Update Error",
      message: "Failed to start update check.",
      detail: e.message
    });
    isManualCheck = false;
  }
}
async function checkForUpdatesLinux(isManual = false) {
  const latestJsonUrl = getLatestJsonUrl();
  const installPageUrl = getInstallPageUrl();
  log("INFO", `Linux check started (isManual: ${isManual})`);
  log("INFO", `Checking URL: ${latestJsonUrl}`);
  try {
    const response = await fetch(latestJsonUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const latest = await response.json();
    const currentVersion = import_electron.app.getVersion();
    log("INFO", `Linux Version: Current=${currentVersion}, Latest=${latest.version}`);
    if (import_semver.default.gt(latest.version, currentVersion)) {
      const { response: buttonIndex } = await import_electron.dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: `A new version (${latest.version}) is available.`,
        detail: "Linux auto-updates are not supported. Open download page?",
        buttons: ["Open Download Page", "Later"],
        defaultId: 0
      });
      if (buttonIndex === 0) {
        import_electron.shell.openExternal(installPageUrl);
      }
    } else if (isManual) {
      import_electron.dialog.showMessageBox({
        type: "info",
        title: "No Updates",
        message: "You're up to date!",
        detail: `Mosaic Companion ${currentVersion} is the latest version.`
      });
    }
  } catch (err) {
    log("ERROR", "Linux check failed:", err.message);
    if (isManual) {
      import_electron.dialog.showMessageBox({
        type: "error",
        title: "Update Error",
        message: "Failed to check for updates.",
        detail: err.message
      });
    }
  }
}
import_electron.autoUpdater.on("error", (err) => {
  log("ERROR", ">>> EVENT: error");
  log("ERROR", err.message);
  if (err.stack) log("ERROR", err.stack);
  if (isManualCheck) {
    import_electron.dialog.showMessageBox({
      type: "error",
      title: "Update Error",
      message: "An error occurred while checking for updates.",
      detail: err.message
    });
    isManualCheck = false;
  }
});
import_electron.autoUpdater.on("checking-for-update", () => {
  log("INFO", ">>> EVENT: checking-for-update");
});
import_electron.autoUpdater.on("update-available", () => {
  log("INFO", ">>> EVENT: update-available");
  log("INFO", "Update available, downloading in background...");
  if (isManualCheck) {
    isManualCheck = false;
  }
});
import_electron.autoUpdater.on("update-not-available", () => {
  log("INFO", ">>> EVENT: update-not-available");
  if (isManualCheck) {
    import_electron.dialog.showMessageBox({
      type: "info",
      title: "No Updates",
      message: "You remain on the bleeding edge.",
      detail: `Version ${import_electron.app.getVersion()} is the latest.`
    });
    isManualCheck = false;
  }
});
import_electron.autoUpdater.on("update-downloaded", (event, releaseNotes, releaseName, releaseDate, updateURL) => {
  log("INFO", ">>> EVENT: update-downloaded");
  log("INFO", `Release Name: ${releaseName}`);
  import_electron.dialog.showMessageBox({
    type: "info",
    title: "Update Ready",
    message: "A new version has been downloaded.",
    detail: "The application will restart to install the update.",
    buttons: ["Restart Now", "Later"],
    defaultId: 0
  }).then((result) => {
    if (result.response === 0) {
      log("INFO", "User accepted restart");
      import_electron.autoUpdater.quitAndInstall();
    } else {
      log("INFO", "User deferred restart");
    }
  });
});

// electron/settings.ts
var import_electron3 = require("electron");
var import_fs3 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));

// electron/utils/index.ts
var import_fs2 = __toESM(require("fs"));
var import_electron2 = require("electron");
var import_path2 = __toESM(require("path"));
function getDirectoryStatus(dirPath) {
  try {
    const stat = import_fs2.default.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { exists: true, isDirectory: false, isEmpty: null };
    }
    const files = import_fs2.default.readdirSync(dirPath);
    return { exists: true, isDirectory: true, isEmpty: files.length === 0 };
  } catch (err) {
    if (err instanceof Error && err.code === "ENOENT") {
      return { exists: false, isDirectory: false, isEmpty: null };
    }
    throw err;
  }
}
var agentsHistoryPath = import_path2.default.join(import_electron2.app.getPath("userData"), "agents_history");
function getAgentHistoryFolder(agentId) {
  return import_path2.default.join(agentsHistoryPath, agentId.toString());
}
function getChatSessionPath(agentId, sessionId) {
  return import_path2.default.join(getAgentHistoryFolder(agentId), `${sessionId}.json`);
}
function ensureAgentFolder(agentId) {
  const folderPath = getAgentHistoryFolder(agentId);
  if (!import_fs2.default.existsSync(folderPath)) {
    import_fs2.default.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}
function readAgentHistories(agentId) {
  try {
    const folderPath = getAgentHistoryFolder(agentId);
    if (!import_fs2.default.existsSync(folderPath)) {
      return [];
    }
    const files = import_fs2.default.readdirSync(folderPath);
    const sessions = [];
    for (const file of files) {
      if (import_path2.default.extname(file).toLowerCase() !== ".json") {
        continue;
      }
      try {
        const filePath = import_path2.default.join(folderPath, file);
        const fileContent = import_fs2.default.readFileSync(filePath, "utf-8");
        const session = JSON.parse(fileContent);
        sessions.push(session);
      } catch (parseError) {
        console.error(`Failed to parse ${file}:`, parseError);
      }
    }
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sessions;
  } catch (error) {
    console.error("Failed to read agent histories:", error);
    return [];
  }
}
function readAgentHistory(agentId, sessionId) {
  try {
    const filePath = getChatSessionPath(agentId, sessionId);
    if (!import_fs2.default.existsSync(filePath)) {
      return null;
    }
    const data = import_fs2.default.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read agent history:", error);
    return null;
  }
}
function writeAgentHistory(chatSession) {
  try {
    ensureAgentFolder(chatSession.agentId);
    const filePath = getChatSessionPath(chatSession.agentId, chatSession.id);
    import_fs2.default.writeFileSync(filePath, JSON.stringify(chatSession, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to write agent history:", error);
    return false;
  }
}
function deleteAgentHistory(agentId, sessionId) {
  try {
    const filePath = getChatSessionPath(agentId, sessionId);
    if (import_fs2.default.existsSync(filePath)) {
      import_fs2.default.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.error("Failed to delete agent history:", error);
    return false;
  }
}
function deleteAllAgentHistories(agentId) {
  try {
    const folderPath = getAgentHistoryFolder(agentId);
    if (import_fs2.default.existsSync(folderPath)) {
      import_fs2.default.rmSync(folderPath, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    console.error("Failed to delete all agent histories:", error);
    return false;
  }
}
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

// electron/settings.ts
var settingsPath = import_path3.default.join(import_electron3.app.getPath("userData"), "app-settings.json");
var DEFAULT_SETTINGS = {
  autoDownload: false,
  titleBarStyle: process.platform === "darwin" ? "default" : "hidden",
  nodes: [],
  gmailAutoMarkRead: false
  // Auto-mark emails as read when viewed
};
var settings = { ...DEFAULT_SETTINGS };
function loadSettings() {
  try {
    if (import_fs3.default.existsSync(settingsPath)) {
      const data = import_fs3.default.readFileSync(settingsPath, "utf8");
      const loaded = JSON.parse(data);
      settings = {
        ...DEFAULT_SETTINGS,
        ...loaded,
        nodes: loaded.nodes || []
      };
      if (!settings.titleBarStyle) {
        settings.titleBarStyle = DEFAULT_SETTINGS.titleBarStyle;
      }
      console.log("Settings loaded from:", settingsPath);
    } else {
      console.log("No settings file found, using defaults");
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
    settings = { ...DEFAULT_SETTINGS };
  }
  return settings;
}
function saveSettings() {
  try {
    import_fs3.default.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    console.log("Settings saved to:", settingsPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
function getUpdateSettings() {
  return {
    autoDownload: settings.autoDownload,
    titleBarStyle: settings.titleBarStyle,
    nodes: [...settings.nodes]
  };
}
function setUpdateSettings(newSettings) {
  if (typeof newSettings.autoDownload === "boolean") {
    settings.autoDownload = newSettings.autoDownload;
  }
  if (typeof newSettings.titleBarStyle === "string") {
    settings.titleBarStyle = newSettings.titleBarStyle;
  }
  const saveResult = saveSettings();
  return { ...saveResult, settings: getUpdateSettings() };
}
function getTitleBarStyle() {
  return settings.titleBarStyle;
}
function getGmailAutoMarkRead() {
  return settings.gmailAutoMarkRead || false;
}
function setGmailAutoMarkRead(value) {
  settings.gmailAutoMarkRead = !!value;
  return saveSettings();
}
var MAX_NODES = 3;
function getNodes() {
  return [...settings.nodes];
}
function addNode(node) {
  if (settings.nodes.length >= MAX_NODES) {
    return { success: false, error: `Maximum ${MAX_NODES} nodes allowed` };
  }
  const newNode = {
    id: `node-${Date.now()}`,
    name: node.name || "New Node",
    apiHost: node.apiHost || "",
    apiPort: node.apiPort || "8000",
    hasAdminPanel: node.hasAdminPanel || false,
    adminHost: node.adminHost || "",
    adminPort: node.adminPort || "8006",
    isActive: node.isActive !== void 0 ? node.isActive : true
  };
  settings.nodes.push(newNode);
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}
function updateNode(id, updates) {
  const index = settings.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }
  settings.nodes[index] = { ...settings.nodes[index], ...updates };
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}
function deleteNode(id) {
  const index = settings.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }
  settings.nodes.splice(index, 1);
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}
loadSettings();

// electron/integrations/mcp/index.ts
var import_electron4 = require("electron");
var path4 = __toESM(require("path"));

// electron/integrations/mcp/MCPClient.ts
var import_child_process = require("child_process");
var readline = __toESM(require("readline"));
var import_events = require("events");
var MCPClient = class extends import_events.EventEmitter {
  constructor(options = {}) {
    super();
    this.connections = /* @__PURE__ */ new Map();
    this.options = {
      timeout: options.timeout ?? 3e4,
      debug: options.debug ?? false
    };
  }
  log(...args) {
    if (this.options.debug) {
      console.error("[MCP]", ...args);
    }
  }
  // ==========================================================================
  // Connection Management
  // ==========================================================================
  /**
   * Connect to an MCP server via STDIO transport
   */
  async connectStdio(name, command, args = [], env) {
    if (this.connections.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }
    this.log(`Connecting to ${name} via STDIO: ${command} ${args.join(" ")}`);
    const connection = {
      config: { name, transport: "stdio", command, args, env },
      transport: "stdio",
      requestId: 0,
      pendingRequests: /* @__PURE__ */ new Map(),
      capabilities: {},
      initialized: false,
      tools: [],
      resources: [],
      prompts: []
    };
    const childProcess4 = (0, import_child_process.spawn)(command, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"]
    });
    connection.process = childProcess4;
    const rl = readline.createInterface({
      input: childProcess4.stdout,
      crlfDelay: Infinity
    });
    rl.on("line", (line) => {
      this.handleStdioMessage(name, line);
    });
    childProcess4.stderr?.on("data", (data) => {
      this.log(`${name} stderr:`, data.toString().trim());
    });
    childProcess4.on("exit", (code, signal) => {
      this.log(`${name} exited with code ${code}, signal ${signal}`);
      this.handleDisconnect(name, code ?? 0);
    });
    childProcess4.on("error", (error) => {
      this.log(`${name} error:`, error);
      this.emit("error", { server: name, error });
    });
    this.connections.set(name, connection);
    return this.initializeConnection(name);
  }
  /**
   * Connect to an MCP server via HTTP transport (Streamable HTTP)
   */
  async connectHttp(name, url, apiKey) {
    if (this.connections.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }
    this.log(`Connecting to ${name} via HTTP: ${url}`);
    const connection = {
      config: { name, transport: "http", url, apiKey },
      transport: "http",
      url,
      apiKey,
      requestId: 0,
      pendingRequests: /* @__PURE__ */ new Map(),
      capabilities: {},
      initialized: false,
      tools: [],
      resources: [],
      prompts: []
    };
    this.connections.set(name, connection);
    return this.initializeConnection(name);
  }
  /**
   * Connect using a config object (convenience for Electron IPC)
   */
  async connect(config2) {
    if (config2.transport === "stdio") {
      if (!config2.command) {
        throw new Error("STDIO transport requires a command");
      }
      return this.connectStdio(
        config2.name,
        config2.command,
        config2.args,
        config2.env
      );
    } else {
      if (!config2.url) {
        throw new Error("HTTP transport requires a URL");
      }
      return this.connectHttp(config2.name, config2.url, config2.apiKey);
    }
  }
  /**
   * Disconnect from an MCP server
   */
  async disconnect(name) {
    const connection = this.connections.get(name);
    if (!connection) return;
    if (connection.process) {
      connection.process.kill();
    }
    for (const [, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.connections.delete(name);
    this.log(`Disconnected from ${name}`);
    this.emit("disconnected", { server: name });
  }
  /**
   * Disconnect from all servers
   */
  async disconnectAll() {
    const names = Array.from(this.connections.keys());
    await Promise.all(names.map((name) => this.disconnect(name)));
  }
  /**
   * Check if a server is connected and initialized
   */
  isConnected(name) {
    return this.connections.has(name) && this.connections.get(name).initialized;
  }
  /**
   * Get list of connected server names
   */
  getConnectedServers() {
    return Array.from(this.connections.keys());
  }
  /**
   * Get detailed server info (for IPC/UI)
   */
  getServers() {
    return Array.from(this.connections.entries()).map(([name, conn]) => ({
      name,
      transport: conn.transport,
      initialized: conn.initialized,
      tools: conn.tools,
      resources: conn.resources,
      prompts: conn.prompts
    }));
  }
  // ==========================================================================
  // Initialization
  // ==========================================================================
  async initializeConnection(name) {
    const result = await this.sendRequest(
      name,
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: "typescript-mcp-client",
          version: "1.0.0"
        }
      }
    );
    const connection = this.connections.get(name);
    connection.capabilities = result.capabilities;
    connection.serverInfo = result.serverInfo;
    await this.sendNotification(name, "notifications/initialized", {});
    connection.initialized = true;
    await this.refreshCapabilities(name);
    this.emit("connected", { server: name, capabilities: result });
    return result;
  }
  /**
   * Refresh tools, resources, and prompts from a server
   */
  async refreshCapabilities(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);
    try {
      const toolsResult = await this.sendRequest(
        serverName,
        "tools/list",
        {}
      );
      connection.tools = toolsResult.tools || [];
      this.log(
        `${serverName} tools:`,
        connection.tools.map((t) => t.name)
      );
    } catch {
      this.log(`${serverName} does not support tools`);
      connection.tools = [];
    }
    try {
      const resourcesResult = await this.sendRequest(serverName, "resources/list", {});
      connection.resources = resourcesResult.resources || [];
      this.log(
        `${serverName} resources:`,
        connection.resources.map((r) => r.uri)
      );
    } catch {
      this.log(`${serverName} does not support resources`);
      connection.resources = [];
    }
    try {
      const promptsResult = await this.sendRequest(
        serverName,
        "prompts/list",
        {}
      );
      connection.prompts = promptsResult.prompts || [];
      this.log(
        `${serverName} prompts:`,
        connection.prompts.map((p) => p.name)
      );
    } catch {
      this.log(`${serverName} does not support prompts`);
      connection.prompts = [];
    }
  }
  // ==========================================================================
  // Tools
  // ==========================================================================
  /**
   * List available tools from a server
   */
  async listTools(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);
    return connection.tools;
  }
  /**
   * Fetch fresh tools from a server (bypasses cache)
   */
  async fetchTools(serverName) {
    const result = await this.sendRequest(
      serverName,
      "tools/list",
      {}
    );
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.tools = result.tools || [];
    }
    return result.tools || [];
  }
  /**
   * Call a tool on a server
   */
  async callTool(serverName, toolName, args = {}) {
    return this.sendRequest(serverName, "tools/call", {
      name: toolName,
      arguments: args
    });
  }
  // ==========================================================================
  // Resources
  // ==========================================================================
  /**
   * List available resources from a server
   */
  async listResources(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);
    return connection.resources;
  }
  /**
   * Fetch fresh resources from a server (bypasses cache)
   */
  async fetchResources(serverName) {
    const result = await this.sendRequest(
      serverName,
      "resources/list",
      {}
    );
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.resources = result.resources || [];
    }
    return result.resources || [];
  }
  /**
   * List resource templates from a server
   */
  async listResourceTemplates(serverName) {
    const result = await this.sendRequest(serverName, "resources/templates/list", {});
    return result.resourceTemplates || [];
  }
  /**
   * Read a resource from a server
   */
  async readResource(serverName, uri) {
    return this.sendRequest(serverName, "resources/read", { uri });
  }
  // ==========================================================================
  // Prompts
  // ==========================================================================
  /**
   * List available prompts from a server
   */
  async listPrompts(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);
    return connection.prompts;
  }
  /**
   * Fetch fresh prompts from a server (bypasses cache)
   */
  async fetchPrompts(serverName) {
    const result = await this.sendRequest(
      serverName,
      "prompts/list",
      {}
    );
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.prompts = result.prompts || [];
    }
    return result.prompts || [];
  }
  /**
   * Get a prompt from a server
   */
  async getPrompt(serverName, promptName, args = {}) {
    return this.sendRequest(serverName, "prompts/get", {
      name: promptName,
      arguments: args
    });
  }
  // ==========================================================================
  // Aggregate Helpers (multi-server)
  // ==========================================================================
  /**
   * Get all tools from all connected servers, with server origin tracking
   */
  async getAllTools() {
    const allTools = [];
    for (const name of this.getConnectedServers()) {
      const tools = await this.listTools(name);
      for (const tool of tools) {
        allTools.push({ ...tool, _serverName: name });
      }
    }
    return allTools;
  }
  /**
   * Build a tool-name → server-name map for routing tool calls
   */
  async buildToolMap() {
    const map = /* @__PURE__ */ new Map();
    for (const name of this.getConnectedServers()) {
      const tools = await this.listTools(name);
      for (const tool of tools) {
        map.set(tool.name, name);
      }
    }
    return map;
  }
  // ==========================================================================
  // Message Handling (private)
  // ==========================================================================
  async sendRequest(serverName, method, params) {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Server "${serverName}" is not connected`);
    }
    const id = ++connection.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };
    this.log(`\u2192 ${serverName}:`, method, params);
    if (connection.transport === "http") {
      return this.sendHttpRequest(connection, request);
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(
          new Error(
            `Request "${method}" timed out after ${this.options.timeout}ms`
          )
        );
      }, this.options.timeout);
      connection.pendingRequests.set(id, {
        resolve,
        reject,
        timeout
      });
      connection.process?.stdin?.write(JSON.stringify(request) + "\n");
    });
  }
  async sendHttpRequest(connection, request) {
    const headers = {
      "Content-Type": "application/json"
    };
    if (connection.apiKey) {
      headers["Authorization"] = `Bearer ${connection.apiKey}`;
    }
    const response = await fetch(connection.url, {
      method: "POST",
      headers,
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (result.error) {
      const error = new Error(result.error.message);
      error.code = result.error.code;
      error.data = result.error.data;
      throw error;
    }
    this.log(`\u2190 HTTP:`, result.result);
    return result.result;
  }
  async sendNotification(serverName, method, params) {
    const connection = this.connections.get(serverName);
    if (!connection) return;
    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };
    if (connection.transport === "stdio" && connection.process) {
      connection.process.stdin?.write(JSON.stringify(notification) + "\n");
    } else if (connection.transport === "http") {
      fetch(connection.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...connection.apiKey && {
            Authorization: `Bearer ${connection.apiKey}`
          }
        },
        body: JSON.stringify(notification)
      }).catch(() => {
      });
    }
  }
  handleStdioMessage(serverName, line) {
    const connection = this.connections.get(serverName);
    if (!connection) return;
    try {
      const message = JSON.parse(line);
      this.log(`\u2190 ${serverName}:`, message);
      if ("id" in message && message.id !== null) {
        const pending = connection.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          connection.pendingRequests.delete(message.id);
          if (message.error) {
            const error = new Error(message.error.message);
            error.code = message.error.code;
            error.data = message.error.data;
            pending.reject(error);
          } else {
            pending.resolve(message.result);
          }
        }
      } else {
        this.handleNotification(serverName, message);
      }
    } catch (error) {
      this.log(`Failed to parse message from ${serverName}:`, error);
    }
  }
  handleNotification(serverName, notification) {
    this.emit("notification", {
      server: serverName,
      method: notification.method,
      params: notification.params
    });
    switch (notification.method) {
      case "notifications/tools/list_changed":
        this.refreshCapabilities(serverName);
        this.emit("tools-changed", { server: serverName });
        break;
      case "notifications/resources/list_changed":
        this.refreshCapabilities(serverName);
        this.emit("resources-changed", { server: serverName });
        break;
      case "notifications/prompts/list_changed":
        this.refreshCapabilities(serverName);
        this.emit("prompts-changed", { server: serverName });
        break;
    }
  }
  handleDisconnect(serverName, code) {
    const connection = this.connections.get(serverName);
    if (!connection) return;
    for (const [, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Server disconnected with code ${code}`));
    }
    this.connections.delete(serverName);
    this.emit("disconnected", { server: serverName, code });
  }
};
function mcpToolsToOpenAI(tools) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}
function mcpToolsToAnthropic(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.inputSchema
  }));
}
function mcpResultToString(result) {
  return result.content.map((content) => {
    if (content.type === "text" && content.text) {
      return content.text;
    }
    if (content.type === "image" && content.data) {
      return `[Image: ${content.mimeType || "unknown type"}]`;
    }
    if (content.type === "resource" && content.uri) {
      return `[Resource: ${content.uri}]`;
    }
    return "";
  }).filter(Boolean).join("\n");
}

// electron/integrations/mcp/recipes/agentLoop.ts
async function runAgentLoop(mcp, provider, serverNames, userQuery, options = {}) {
  const {
    maxIterations = 10,
    onBeforeToolCall,
    onToolResult,
    onIteration,
    onText
  } = options;
  const toolMap = /* @__PURE__ */ new Map();
  const allTools = [];
  for (const serverName of serverNames) {
    const tools = await mcp.listTools(serverName);
    for (const tool of tools) {
      if (toolMap.has(tool.name)) {
        const prefixed = `${serverName}__${tool.name}`;
        toolMap.set(prefixed, serverName);
        allTools.push({ ...tool, name: prefixed });
      } else {
        toolMap.set(tool.name, serverName);
        allTools.push(tool);
      }
    }
  }
  const systemPrompt = options.systemPrompt ?? buildDefaultSystemPrompt(allTools);
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery }
  ];
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    onIteration?.(iteration, messages);
    const response = await provider.chat(messages, allTools);
    const assistantMessage = {
      role: "assistant",
      content: response.content
    };
    if (response.toolCalls && response.toolCalls.length > 0) {
      assistantMessage.tool_calls = response.toolCalls;
    }
    messages.push(assistantMessage);
    if (response.content) {
      onText?.(response.content);
    }
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return { content: response.content, messages, iterations: iteration };
    }
    for (const toolCall of response.toolCalls) {
      const result = await executeToolCall(
        mcp,
        toolMap,
        toolCall,
        onBeforeToolCall,
        onToolResult
      );
      messages.push({
        role: "tool",
        content: result,
        tool_call_id: toolCall.id
      });
    }
  }
  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  return {
    content: lastAssistant?.content || "[Agent reached maximum iterations without a final response]",
    messages,
    iterations: maxIterations
  };
}
async function executeToolCall(mcp, toolMap, toolCall, onBeforeToolCall, onToolResult) {
  const serverName = toolMap.get(toolCall.name);
  if (!serverName) {
    return `Error: Unknown tool "${toolCall.name}"`;
  }
  const actualToolName = toolCall.name.includes("__") ? toolCall.name.split("__").slice(1).join("__") : toolCall.name;
  if (onBeforeToolCall) {
    const approved = await onBeforeToolCall(
      actualToolName,
      toolCall.arguments,
      serverName
    );
    if (!approved) {
      return `Tool call "${actualToolName}" was blocked by user.`;
    }
  }
  try {
    const result = await mcp.callTool(serverName, actualToolName, toolCall.arguments);
    const resultText = mcpResultToString(result);
    onToolResult?.(actualToolName, resultText, serverName);
    if (result.isError) {
      return `Tool error: ${resultText}`;
    }
    return resultText;
  } catch (error) {
    const errorMsg = `Tool execution error: ${error.message}`;
    return errorMsg;
  }
}
function buildDefaultSystemPrompt(tools) {
  const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description || "No description"}`).join("\n");
  return `You are a helpful assistant with access to tools. Use them to help answer the user's questions.

Available tools:
${toolDescriptions}

When you need information or need to perform an action, use the appropriate tool. You can call multiple tools in sequence. Once you have enough information, provide a clear, helpful answer.`;
}

// electron/integrations/mcp/providers/openai.ts
var OpenAIProvider = class {
  constructor(apiKey, defaultModel = "gpt-4-turbo-preview") {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }
  async chat(messages, tools, options) {
    const openaiMessages = messages.map((m) => {
      const msg = {
        role: m.role,
        content: m.content
      };
      if (m.tool_calls) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        }));
      }
      if (m.tool_call_id) {
        msg.tool_call_id = m.tool_call_id;
      }
      return msg;
    });
    const body = {
      model: options?.model ?? this.defaultModel,
      messages: openaiMessages
    };
    if (tools.length > 0) {
      body.tools = mcpToolsToOpenAI(tools);
      body.tool_choice = "auto";
    }
    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.temperature !== void 0) {
      body.temperature = options.temperature;
    }
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }
    const data = await response.json();
    const choice = data.choices[0];
    let toolCalls;
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      toolCalls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }));
    }
    return {
      content: choice.message.content || "",
      toolCalls
    };
  }
};

// electron/integrations/mcp/providers/anthropic.ts
var AnthropicProvider = class {
  constructor(apiKey, defaultModel = "claude-sonnet-4-20250514", apiVersion = "2023-06-01") {
    if (!apiKey) {
      throw new Error("Anthropic API key is required");
    }
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.apiVersion = apiVersion;
  }
  async chat(messages, tools, options) {
    const systemMessage = messages.find((m) => m.role === "system")?.content || "";
    const anthropicMessages = messages.filter((m) => m.role !== "system").map((m) => this.convertMessage(m));
    const body = {
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: anthropicMessages
    };
    if (systemMessage) {
      body.system = systemMessage;
    }
    if (tools.length > 0) {
      body.tools = mcpToolsToAnthropic(tools);
    }
    if (options?.temperature !== void 0) {
      body.temperature = options.temperature;
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.apiVersion
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }
    const data = await response.json();
    const textContent = data.content.filter((c) => c.type === "text").map((c) => c.text || "").join("");
    const toolUses = data.content.filter((c) => c.type === "tool_use");
    let toolCalls;
    if (toolUses.length > 0) {
      toolCalls = toolUses.map((tu) => ({
        id: tu.id,
        name: tu.name,
        arguments: tu.input || {}
      }));
    }
    return {
      content: textContent,
      toolCalls
    };
  }
  convertMessage(m) {
    if (m.role === "tool") {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.tool_call_id,
            content: m.content
          }
        ]
      };
    }
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const content = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      for (const tc of m.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments
        });
      }
      return { role: "assistant", content };
    }
    return {
      role: m.role === "user" ? "user" : "assistant",
      content: m.content
    };
  }
};

// electron/integrations/mcp/index.ts
var mcpClient = new MCPClient({ debug: true });
var mainWindow = null;
function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}
mcpClient.on("connected", ({ server }) => {
  const servers = mcpClient.getServers();
  const serverInfo = servers.find((s) => s.name === server);
  notifyRenderer("mcp:server-connected", {
    name: server,
    tools: serverInfo?.tools ?? [],
    resources: serverInfo?.resources ?? [],
    prompts: serverInfo?.prompts ?? []
  });
});
mcpClient.on("disconnected", ({ server, code }) => {
  notifyRenderer("mcp:server-disconnected", { name: server, code });
});
mcpClient.on("error", ({ server, error }) => {
  notifyRenderer("mcp:server-error", {
    name: server,
    error: error.message
  });
});
mcpClient.on("notification", ({ server, method, params }) => {
  notifyRenderer("mcp:notification", { server, method, params });
});
mcpClient.on("tools-changed", ({ server }) => {
  const servers = mcpClient.getServers();
  const serverInfo = servers.find((s) => s.name === server);
  notifyRenderer("mcp:tools-changed", {
    name: server,
    tools: serverInfo?.tools ?? []
  });
});
mcpClient.on("resources-changed", ({ server }) => {
  const servers = mcpClient.getServers();
  const serverInfo = servers.find((s) => s.name === server);
  notifyRenderer("mcp:resources-changed", {
    name: server,
    resources: serverInfo?.resources ?? []
  });
});
import_electron4.ipcMain.handle("mcp:connect", async (_event, config2) => {
  try {
    await mcpClient.connect(config2);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron4.ipcMain.handle("mcp:disconnect", async (_event, serverName) => {
  try {
    await mcpClient.disconnect(serverName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron4.ipcMain.handle("mcp:list-servers", () => {
  return mcpClient.getServers();
});
import_electron4.ipcMain.handle(
  "mcp:call-tool",
  async (_event, serverName, toolName, args) => {
    try {
      const result = await mcpClient.callTool(serverName, toolName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
import_electron4.ipcMain.handle("mcp:list-tools", async (_event, serverName) => {
  try {
    const tools = await mcpClient.listTools(serverName);
    return { success: true, tools };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron4.ipcMain.handle(
  "mcp:read-resource",
  async (_event, serverName, uri) => {
    try {
      const result = await mcpClient.readResource(serverName, uri);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
import_electron4.ipcMain.handle("mcp:list-resources", async (_event, serverName) => {
  try {
    const resources = await mcpClient.listResources(serverName);
    return { success: true, resources };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron4.ipcMain.handle(
  "mcp:get-prompt",
  async (_event, serverName, promptName, args) => {
    try {
      const result = await mcpClient.getPrompt(serverName, promptName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
import_electron4.ipcMain.handle("mcp:list-prompts", async (_event, serverName) => {
  try {
    const prompts = await mcpClient.listPrompts(serverName);
    return { success: true, prompts };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron4.ipcMain.handle("mcp:run-agent", async (_event, request) => {
  try {
    const provider = createProvider(request.provider, request.model);
    const result = await runAgentLoop(
      mcpClient,
      provider,
      request.serverNames,
      request.query,
      {
        maxIterations: request.maxIterations,
        systemPrompt: request.systemPrompt,
        onToolResult: (toolName, resultText, serverName) => {
          notifyRenderer("mcp:agent-tool-result", {
            toolName,
            result: resultText,
            server: serverName
          });
        },
        onText: (text) => {
          notifyRenderer("mcp:agent-text", { text });
        }
      }
    );
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
function createProvider(provider, model) {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable not set");
    return new OpenAIProvider(apiKey, model);
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      throw new Error("ANTHROPIC_API_KEY environment variable not set");
    return new AnthropicProvider(apiKey, model);
  }
}
function createWindow() {
  mainWindow = new import_electron4.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path4.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path4.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron4.app.whenReady().then(() => {
  createWindow();
  import_electron4.app.on("activate", () => {
    if (import_electron4.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron4.app.on("window-all-closed", () => {
  mcpClient.disconnectAll();
  if (process.platform !== "darwin") {
    import_electron4.app.quit();
  }
});
import_electron4.app.on("before-quit", () => {
  mcpClient.disconnectAll();
});

// electron/integrations/mosaicbot/src/main/index.ts
var import_electron6 = require("electron");
var import_node_path4 = __toESM(require("node:path"));

// electron/integrations/mosaicbot/src/main/heartbeat/types.ts
var WAKE_PRIORITY = {
  retry: 0,
  // automatic retry after failure
  interval: 1,
  // scheduled tick
  default: 2,
  // generic on-demand request
  action: 3
  // manual / exec-event / hook (highest)
};

// electron/integrations/mosaicbot/src/main/heartbeat/wake.ts
var DEFAULT_COALESCE_MS = 250;
var RETRY_COOLDOWN_MS = 1e3;
var wakeHandler = null;
var timer = null;
var timerDueAt = 0;
var timerIsRetry = false;
var pendingRequests = [];
function setHeartbeatWakeHandler(handler) {
  wakeHandler = handler;
  return () => {
    if (wakeHandler === handler) {
      wakeHandler = null;
      clearTimer();
    }
  };
}
function requestHeartbeatNow(req = {}) {
  const request = {
    agentId: req.agentId,
    reason: req.reason ?? "default",
    priority: req.priority ?? WAKE_PRIORITY.default
  };
  const idx = pendingRequests.findIndex((r) => r.agentId === request.agentId);
  if (idx >= 0) {
    if (request.priority > pendingRequests[idx].priority) {
      pendingRequests[idx] = request;
    }
  } else {
    pendingRequests.push(request);
  }
  scheduleWake(DEFAULT_COALESCE_MS);
}
function scheduleWake(coalesceMs, isRetry = false) {
  const dueAt = Date.now() + coalesceMs;
  if (timer && timerIsRetry && !isRetry) return;
  if (timer && timerDueAt <= dueAt) return;
  clearTimer();
  timerDueAt = dueAt;
  timerIsRetry = isRetry;
  timer = setTimeout(async () => {
    timer = null;
    timerIsRetry = false;
    const reqs = pendingRequests.splice(0);
    if (wakeHandler && reqs.length > 0) {
      try {
        await wakeHandler(reqs);
      } catch {
        scheduleWake(RETRY_COOLDOWN_MS, true);
      }
    }
  }, coalesceMs);
}
function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

// electron/integrations/mosaicbot/src/main/heartbeat/runner.ts
var TOKEN_RE = /(\*\*HEARTBEAT_OK\*\*|<b>HEARTBEAT_OK<\/b>|HEARTBEAT_OK)/g;
function startHeartbeatRunner(opts) {
  const states = /* @__PURE__ */ new Map();
  let stopped = false;
  for (const agentCfg of opts.agents) {
    if (!agentCfg.heartbeat.enabled) continue;
    const state = {
      agentId: agentCfg.agentId,
      cfg: agentCfg.heartbeat,
      lastRunAt: 0,
      nextDueAt: Date.now() + agentCfg.heartbeat.intervalMs,
      timer: null
    };
    states.set(agentCfg.agentId, state);
    scheduleAgent(state);
  }
  const removeWake = setHeartbeatWakeHandler(
    async (requests) => {
      if (stopped) return;
      const ids = new Set(
        requests.map((r) => r.agentId).filter(Boolean)
      );
      const targets = ids.size > 0 ? ids : new Set(states.keys());
      for (const id of targets) {
        const state = states.get(id);
        if (state) await runHeartbeat(state);
      }
    }
  );
  function scheduleAgent(state) {
    if (stopped || state.timer) return;
    const delay = Math.max(0, state.nextDueAt - Date.now());
    state.timer = setTimeout(async () => {
      state.timer = null;
      if (!stopped) {
        await runHeartbeat(state);
        state.lastRunAt = Date.now();
        state.nextDueAt = state.lastRunAt + state.cfg.intervalMs;
        scheduleAgent(state);
      }
    }, delay);
  }
  async function runHeartbeat(state) {
    const { agentId, cfg } = state;
    const startedAt = Date.now();
    if (cfg.activeHours && !isWithinActiveHours(cfg.activeHours)) {
      emit({
        ts: startedAt,
        agentId,
        status: "skipped",
        reason: "quiet-hours"
      });
      return;
    }
    const basePrompt = cfg.prompt ?? "Check HEARTBEAT.md for pending tasks. If nothing needs attention, reply HEARTBEAT_OK.";
    const prompt = await buildPromptWithMemory(basePrompt, cfg, opts.memory);
    let rawReply = null;
    try {
      rawReply = await opts.onReply({
        agentId,
        prompt,
        now: new Date(startedAt)
      });
    } catch (err) {
      emit({
        ts: startedAt,
        agentId,
        status: "failed",
        reason: String(err),
        durationMs: Date.now() - startedAt
      });
      return;
    }
    const durationMs = Date.now() - startedAt;
    if (!rawReply?.trim()) {
      emit({ ts: startedAt, agentId, status: "ok-empty", durationMs });
      return;
    }
    const alert = stripHeartbeatToken(rawReply, cfg.ackMaxChars ?? 300);
    if (alert === null) {
      emit({ ts: startedAt, agentId, status: "ok-token", durationMs });
      return;
    }
    const channel = cfg.channel ?? "ipc";
    const to = cfg.to ?? agentId;
    try {
      await opts.onDeliver(agentId, channel, to, alert);
      emit({
        ts: startedAt,
        agentId,
        status: "sent",
        channel,
        preview: alert.slice(0, 120),
        durationMs
      });
    } catch (err) {
      emit({
        ts: startedAt,
        agentId,
        status: "failed",
        reason: String(err),
        durationMs
      });
    }
  }
  function emit(evt) {
    opts.onEvent?.(evt);
  }
  return {
    stop() {
      stopped = true;
      removeWake();
      for (const s of states.values()) {
        if (s.timer) clearTimeout(s.timer);
      }
      states.clear();
    },
    triggerNow(agentId) {
      requestHeartbeatNow({ agentId, reason: "action", priority: 3 });
    }
  };
}
async function buildPromptWithMemory(base, cfg, memory) {
  if (!memory || !cfg.memorySearch) return base;
  const ms = cfg.memorySearch;
  const query = ms.query ?? "pending tasks actions reminders";
  const maxResults = ms.maxResults ?? 5;
  const maxChars = ms.maxInjectedChars ?? 2e3;
  let chunks;
  try {
    chunks = await memory.search(query, { maxResults });
  } catch {
    return base;
  }
  if (!chunks.length) return base;
  const lines = [];
  let chars = 0;
  for (const c of chunks) {
    const block = `### ${c.source} (score ${c.score.toFixed(2)})
${c.snippet}`;
    if (chars + block.length > maxChars) break;
    lines.push(block);
    chars += block.length + 1;
  }
  if (!lines.length) return base;
  const memoryBlock = `## Recalled Memory

${lines.join("\n\n")}`;
  return `${memoryBlock}

---

${base}`;
}
function stripHeartbeatToken(raw, ackMaxChars) {
  const stripped = raw.replace(TOKEN_RE, "").trim();
  return !stripped || stripped.length <= ackMaxChars ? null : stripped;
}
function isWithinActiveHours(hours) {
  const now = /* @__PURE__ */ new Date();
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const startMin = toMin(hours.start);
  const endMin = toMin(hours.end);
  const cur = now.getHours() * 60 + now.getMinutes();
  return endMin > startMin ? cur >= startMin && cur < endMin : cur >= startMin || cur < endMin;
}

// electron/integrations/mosaicbot/src/main/channels/registry.ts
var registrations = /* @__PURE__ */ new Map();
var outboundCache = /* @__PURE__ */ new Map();
function registerChannel(plugin) {
  registrations.set(plugin.id, { plugin });
  outboundCache.delete(plugin.id);
}
function loadChannelOutboundAdapter(id) {
  const cached = outboundCache.get(id);
  if (cached) return cached;
  const adapter = registrations.get(id)?.plugin.outbound;
  if (adapter) outboundCache.set(id, adapter);
  return adapter;
}

// electron/integrations/mosaicbot/src/main/channels/deliver.ts
async function deliverMessage(params) {
  const adapter = loadChannelOutboundAdapter(params.channel);
  if (!adapter)
    throw new Error(`No outbound adapter for channel: "${params.channel}"`);
  const chunks = chunkText(params.text, adapter.textChunkLimit ?? 4e3);
  const results = [];
  for (const chunk2 of chunks) {
    const base = {
      cfg: params.cfg,
      to: params.to,
      text: chunk2,
      accountId: params.accountId,
      threadId: params.threadId
    };
    const result = params.mediaUrl && adapter.sendMedia ? await adapter.sendMedia({ ...base, mediaUrl: params.mediaUrl }) : await adapter.sendText(base);
    results.push(result);
  }
  return results;
}
function chunkText(text, limit) {
  if (text.length <= limit) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > 0) {
    let cut = limit;
    const para = rest.lastIndexOf("\n\n", limit);
    if (para > limit / 2) cut = para;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return chunks;
}

// electron/integrations/mosaicbot/src/main/channels/adapters/ipc.ts
var import_electron5 = require("electron");
var ipcChannelPlugin = {
  id: "ipc",
  meta: { label: "In-App (IPC)", order: 0 },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => ["default"],
    defaultAccountId: () => "default",
    resolveAccount: (cfg, accountId = "default") => ({
      accountId,
      enabled: cfg.channels?.ipc?.enabled !== false,
      configured: true
    }),
    isConfigured: (account) => account.enabled
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 65536,
    chunkerMode: "markdown",
    sendText: async ({ to, text }) => {
      const messageId = `ipc-${Date.now()}`;
      for (const win of import_electron5.BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send("agent:message", { to, text, channel: "ipc", messageId });
        }
      }
      return { channel: "ipc", messageId };
    }
  }
};

// electron/integrations/mosaicbot/src/main/channels/adapters/http.ts
var httpChannelPlugin = {
  id: "http",
  meta: { label: "HTTP Webhook", order: 10 },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => ["default"],
    defaultAccountId: () => "default",
    resolveAccount: (cfg, accountId = "default") => ({
      accountId,
      enabled: cfg.channels?.http?.enabled !== false,
      configured: Boolean(cfg.channels?.http?.webhookUrl),
      webhookUrl: cfg.channels?.http?.webhookUrl ?? ""
    }),
    isConfigured: (account) => account.enabled && Boolean(account.webhookUrl)
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4e3,
    chunkerMode: "plain",
    sendText: async ({ cfg, to, text }) => {
      const webhookUrl = cfg.channels?.http?.webhookUrl;
      if (!webhookUrl) throw new Error("http channel: webhookUrl not configured");
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text, ts: Date.now() })
      });
      if (!res.ok) throw new Error(`http channel: POST failed ${res.status}`);
      const json = await res.json().catch(() => ({}));
      return { channel: "http", messageId: json.messageId };
    }
  }
};

// electron/integrations/mosaicbot/src/main/skills/loader.ts
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = __toESM(require("node:path"));
var MAX_SKILL_FILE_BYTES = 256e3;
var MAX_PER_SOURCE = 200;
var SKILL_FILENAME = "SKILL.md";
async function loadSkillEntries(sources) {
  const seen = /* @__PURE__ */ new Map();
  for (const src of sources) {
    for (const entry of await loadFromDir(src.dir, src.source)) {
      seen.set(entry.name.toLowerCase(), entry);
    }
  }
  return [...seen.values()];
}
async function loadFromDir(dir, source) {
  let subdirs;
  try {
    const ents = await import_promises.default.readdir(dir, { withFileTypes: true });
    subdirs = ents.filter((e) => e.isDirectory()).map((e) => import_node_path.default.join(dir, e.name));
  } catch {
    return [];
  }
  const skills = [];
  for (const subdir of subdirs.slice(0, MAX_PER_SOURCE)) {
    const skillPath = import_node_path.default.join(subdir, SKILL_FILENAME);
    try {
      const stat = await import_promises.default.stat(skillPath);
      if (stat.size > MAX_SKILL_FILE_BYTES) continue;
      const content = await import_promises.default.readFile(skillPath, "utf-8");
      const entry = parseSkillFile(skillPath, subdir, source, content);
      if (entry) skills.push(entry);
    } catch {
    }
  }
  return skills;
}
function parseSkillFile(filePath, baseDir, source, content) {
  const fm = extractFrontmatter(content);
  if (!fm) return null;
  const name = fm.name?.trim();
  const description = fm.description?.trim();
  if (!name || !description) return null;
  let metadata = {};
  try {
    if (fm.metadata) {
      const parsed = JSON.parse(fm.metadata);
      metadata = parsed?.OpenMosaic ?? {};
    }
  } catch {
  }
  const policy = {
    userInvocable: fm["user-invocable"] !== "false",
    disableModelInvocation: fm["disable-model-invocation"] === "true"
  };
  let dispatch;
  const dispatchKind = fm["command-dispatch"] ?? fm["command_dispatch"];
  if (dispatchKind === "tool") {
    const toolName = fm["command-tool"] ?? fm["command_tool"];
    if (toolName) {
      dispatch = {
        kind: "tool",
        toolName,
        argMode: fm["command-arg-mode"] === "raw" ? "raw" : void 0
      };
    }
  }
  return {
    name,
    description,
    filePath,
    source,
    baseDir,
    content,
    metadata,
    policy,
    dispatch
  };
}
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) out[key] = val;
  }
  return out;
}
function defaultSkillSources(appDir, workspaceDir) {
  return [
    // Bundled with the app binary (lowest precedence)
    { dir: import_node_path.default.join(__dirname, "../../bundled-skills"), source: "bundled" },
    // User-managed skills
    { dir: import_node_path.default.join(appDir, "skills"), source: "managed" },
    // Workspace-local skills (highest precedence)
    { dir: import_node_path.default.join(workspaceDir, "skills"), source: "workspace" }
  ];
}

// electron/integrations/mosaicbot/src/main/skills/registry.ts
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var import_node_os = __toESM(require("node:os"));
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
var MAX_SKILLS_IN_PROMPT = 150;
var MAX_SKILLS_PROMPT_CHARS = 3e4;
async function buildEligibilityContext(binsToProbe = ["git", "gh", "node", "python3", "docker", "curl"]) {
  const availableBins = /* @__PURE__ */ new Set();
  await Promise.all(
    binsToProbe.map(async (bin) => {
      try {
        await execFileAsync(process.platform === "win32" ? "where" : "which", [
          bin
        ]);
        availableBins.add(bin);
      } catch {
      }
    })
  );
  return {
    platform: import_node_os.default.platform(),
    availableBins,
    availableEnv: new Set(Object.keys(process.env))
  };
}
function isSkillEligible(skill, ctx) {
  const { metadata } = skill;
  if (metadata.always) return true;
  if (metadata.os?.length && !metadata.os.includes(ctx.platform)) return false;
  if (metadata.requires?.bins) {
    for (const bin of metadata.requires.bins) {
      if (!ctx.availableBins.has(bin)) return false;
    }
  }
  if (metadata.requires?.anyBins?.length) {
    if (!metadata.requires.anyBins.some((b) => ctx.availableBins.has(b)))
      return false;
  }
  if (metadata.requires?.env) {
    for (const v of metadata.requires.env) {
      if (!ctx.availableEnv.has(v)) return false;
    }
  }
  return true;
}
function sanitizeCommandName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 32) || "skill";
}
function buildSkillCommandSpecs(skills, reservedNames = /* @__PURE__ */ new Set()) {
  const usedNames = new Set(reservedNames);
  const specs = [];
  for (const skill of skills) {
    if (!skill.policy.userInvocable) continue;
    let name = sanitizeCommandName(skill.name);
    if (usedNames.has(name)) {
      let n = 2;
      while (usedNames.has(`${name}_${n}`)) n++;
      name = `${name}_${n}`;
    }
    usedNames.add(name);
    specs.push({
      name,
      skillName: skill.name,
      description: skill.description,
      dispatch: skill.dispatch
    });
  }
  return specs;
}
function buildSkillSnapshot(skills, ctx, filter) {
  let eligible = skills.filter(
    (s) => !s.policy.disableModelInvocation && isSkillEligible(s, ctx)
  );
  if (filter?.length) {
    const set = new Set(filter.map((n) => n.toLowerCase()));
    eligible = eligible.filter((s) => set.has(s.name.toLowerCase()));
  }
  eligible = eligible.slice(0, MAX_SKILLS_IN_PROMPT);
  const lines = [];
  let chars = 0;
  let truncated = 0;
  for (const s of eligible) {
    const line = `- **${s.name}**: ${s.description}`;
    if (chars + line.length > MAX_SKILLS_PROMPT_CHARS) {
      truncated++;
      continue;
    }
    lines.push(line);
    chars += line.length + 1;
  }
  let prompt = `## Available Skills

${lines.join("\n")}`;
  if (truncated > 0)
    prompt += `

_(${truncated} skills omitted \u2014 context budget reached)_`;
  return {
    prompt,
    skills: eligible,
    commandSpecs: buildSkillCommandSpecs(eligible)
  };
}
function resolveSkillCommand(input, specs) {
  const text = input.trim();
  for (const spec of specs) {
    const p1 = `/${spec.name}`;
    if (text === p1 || text.startsWith(`${p1} `)) {
      return { spec, args: text.slice(p1.length).trim() || void 0 };
    }
    const p2 = `/skill ${spec.skillName}`;
    if (text === p2 || text.startsWith(`${p2} `)) {
      return { spec, args: text.slice(p2.length).trim() || void 0 };
    }
  }
  return null;
}

// electron/integrations/mosaicbot/src/main/memory/sqlite-backend.ts
var import_node_path2 = __toESM(require("node:path"));
var import_promises2 = __toESM(require("node:fs/promises"));
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_chokidar = __toESM(require("chokidar"));

// electron/integrations/mosaicbot/src/main/memory/schema.ts
var SCHEMA_VERSION = 3;
var CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Tracks indexed files with hash-based change detection
  CREATE TABLE IF NOT EXISTS files (
    path   TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'memory',
    hash   TEXT NOT NULL,
    mtime  INTEGER NOT NULL,
    size   INTEGER NOT NULL
  );

  -- Chunked content with optional embeddings (JSON float array, [] when none)
  CREATE TABLE IF NOT EXISTS chunks (
    id         TEXT PRIMARY KEY,
    path       TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'memory',
    start_line INTEGER NOT NULL,
    end_line   INTEGER NOT NULL,
    hash       TEXT NOT NULL,
    model      TEXT NOT NULL,
    text       TEXT NOT NULL,
    embedding  TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Embedding cache: avoids re-embedding unchanged content
  CREATE TABLE IF NOT EXISTS embedding_cache (
    provider     TEXT NOT NULL,
    model        TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    hash         TEXT NOT NULL,
    embedding    TEXT NOT NULL,
    dims         INTEGER,
    updated_at   INTEGER NOT NULL,
    PRIMARY KEY (provider, model, provider_key, hash)
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_path   ON chunks(path);
  CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
  CREATE INDEX IF NOT EXISTS idx_emb_cache_at  ON embedding_cache(updated_at);
`;
var CREATE_FTS_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    text,
    id         UNINDEXED,
    path       UNINDEXED,
    source     UNINDEXED,
    model      UNINDEXED,
    start_line UNINDEXED,
    end_line   UNINDEXED
  );
`;
function createVecTableSQL(dimensions) {
  return `
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      id        TEXT PRIMARY KEY,
      embedding FLOAT[${dimensions}]
    );
  `;
}
var SET_SCHEMA_VERSION_SQL = `
  INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}');
`;

// electron/integrations/mosaicbot/src/main/memory/chunker.ts
var import_node_crypto = __toESM(require("node:crypto"));
var DEFAULTS = { tokens: 400, overlap: 80 };
function chunkText2(content, filePath, source, cfg = {}) {
  const { tokens, overlap } = { ...DEFAULTS, ...cfg };
  const maxBytes = Math.max(32, tokens * 4);
  const overlapBytes = Math.max(0, overlap * 4);
  const rawLines = content.split("\n");
  const lines = [];
  for (const line of rawLines) {
    if (Buffer.byteLength(line, "utf8") <= maxBytes) {
      lines.push(line);
    } else {
      lines.push(...splitToByteLimit(line, maxBytes));
    }
  }
  const chunks = [];
  let current = [];
  let currentBytes = 0;
  let startLine = 1;
  const flush = (endLine) => {
    const text = current.join("\n").trim();
    if (!text) return;
    const textHash = sha256(text);
    const id = sha256(`${filePath}:${startLine}:${endLine}:${textHash}`);
    chunks.push({
      id,
      path: filePath,
      source,
      startLine,
      endLine,
      hash: textHash,
      text
    });
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineBytes = Buffer.byteLength(line, "utf8") + 1;
    if (currentBytes + lineBytes > maxBytes && current.length > 0) {
      flush(startLine + current.length - 1);
      let overlapLines = [];
      let overlapAcc = 0;
      for (let j = current.length - 1; j >= 0; j--) {
        const lb = Buffer.byteLength(current[j], "utf8") + 1;
        if (overlapAcc + lb > overlapBytes) break;
        overlapLines.unshift(current[j]);
        overlapAcc += lb;
      }
      startLine = startLine + current.length - overlapLines.length;
      current = overlapLines;
      currentBytes = overlapAcc;
    }
    current.push(line);
    currentBytes += lineBytes;
  }
  if (current.length > 0) {
    flush(startLine + current.length - 1);
  }
  return chunks;
}
function splitToByteLimit(text, maxBytes) {
  const segments = [];
  let rest = text;
  while (Buffer.byteLength(rest, "utf8") > maxBytes) {
    let lo = 0;
    let hi = rest.length;
    while (lo < hi - 1) {
      const mid = lo + hi >> 1;
      Buffer.byteLength(rest.slice(0, mid), "utf8") <= maxBytes ? lo = mid : hi = mid;
    }
    segments.push(rest.slice(0, lo));
    rest = rest.slice(lo);
  }
  if (rest) segments.push(rest);
  return segments;
}
function sha256(text) {
  return import_node_crypto.default.createHash("sha256").update(text).digest("hex");
}

// electron/integrations/mosaicbot/src/main/memory/scoring.ts
function bm25RankToScore(rank) {
  const normalized = Number.isFinite(rank) ? Math.max(0, -rank) : 0;
  return 1 / (1 + normalized);
}
function buildFtsQuery(raw) {
  const tokens = raw.match(/[\p{L}\p{N}_]+/gu)?.map((t) => t.trim()).filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replaceAll('"', "")}"`).join(" AND ");
}
function mergeResults(vector, keyword, weights) {
  const byId = /* @__PURE__ */ new Map();
  for (const r of vector) {
    byId.set(r.id, {
      ...r,
      vectorScore: r.score,
      textScore: 0,
      finalScore: weights.vector * r.score
    });
  }
  for (const r of keyword) {
    const ts = bm25RankToScore(r.rank);
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = ts;
      existing.finalScore = weights.vector * existing.vectorScore + weights.text * ts;
    } else {
      byId.set(r.id, {
        ...r,
        score: 0,
        vectorScore: 0,
        textScore: ts,
        finalScore: weights.text * ts
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.finalScore - a.finalScore);
}
function applyTemporalDecay(chunks, halfLifeDays, nowMs = Date.now()) {
  const lambda = Math.LN2 / halfLifeDays;
  return chunks.map((c) => {
    const date = extractDateFromPath(c.path);
    if (!date) return c;
    const ageInDays = (nowMs - date.getTime()) / 864e5;
    const multiplier = Math.exp(-lambda * Math.max(0, ageInDays));
    return { ...c, finalScore: c.finalScore * multiplier };
  }).sort((a, b) => b.finalScore - a.finalScore);
}
function extractDateFromPath(filePath) {
  const m = filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
  if (!m) return null;
  const d = /* @__PURE__ */ new Date(`${m[1]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function applyMMR(chunks, lambda, maxResults) {
  if (chunks.length <= 1) return chunks.slice(0, maxResults);
  const scores = chunks.map((c) => c.finalScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const normed = chunks.map((c, i) => ({
    chunk: c,
    norm: (scores[i] - min) / range
  }));
  const tokenSets = chunks.map((c) => tokenize(c.text));
  const selected = [];
  const remaining = new Set(normed.map((_, i) => i));
  while (selected.length < maxResults && remaining.size > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (const i of remaining) {
      const relevance = normed[i].norm;
      const maxSim = selected.length === 0 ? 0 : Math.max(
        ...selected.map((s) => jaccard(tokenSets[i], tokenSets[s]))
      );
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestScore || mmrScore === bestScore && chunks[i].finalScore > chunks[bestIdx]?.finalScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }
  return selected.map((i) => chunks[i]);
}
function tokenize(text) {
  return new Set(text.toLowerCase().match(/[a-z0-9_]+/g) ?? []);
}
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

// electron/integrations/mosaicbot/src/main/memory/embedding.ts
async function createEmbeddingProvider(cfg) {
  if (!cfg || cfg.provider === "none") return NULL_PROVIDER;
  if (cfg.provider === "openai") {
    const model = cfg.model ?? "text-embedding-3-small";
    const dims = cfg.dimensions ?? 1536;
    const baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    );
    return {
      id: "openai",
      model,
      dimensions: dims,
      embed: async (texts) => embedOpenAI(baseUrl, cfg.apiKey, model, dims, texts)
    };
  }
  if (cfg.provider === "ollama") {
    const model = cfg.model ?? "nomic-embed-text";
    const baseUrl = (cfg.baseUrl ?? "http://localhost:11434").replace(
      /\/$/,
      ""
    );
    let dims = cfg.dimensions ?? 0;
    if (!dims) {
      const probe = await embedOllama(baseUrl, model, [" "]);
      dims = probe[0]?.length ?? 0;
    }
    return {
      id: "ollama",
      model,
      dimensions: dims,
      embed: (texts) => embedOllama(baseUrl, model, texts)
    };
  }
  return NULL_PROVIDER;
}
async function embedOpenAI(baseUrl, apiKey, model, dimensions, texts) {
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ input: texts, model, dimensions })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}
async function embedOllama(baseUrl, model, texts) {
  const results = [];
  for (const text of texts) {
    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama embeddings ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    results.push(json.embedding);
  }
  return results;
}
var NULL_PROVIDER = {
  id: "none",
  model: "none",
  dimensions: 0,
  embed: async () => []
};

// electron/integrations/mosaicbot/src/main/memory/sqlite-backend.ts
var SNIPPET_MAX_CHARS = 700;
var EMBED_BATCH_MAX_BYTES = 8e3 * 4;
var RETRY_ATTEMPTS = 3;
var RETRY_BASE_MS = 500;
var SqliteMemoryManager = class _SqliteMemoryManager {
  constructor(db, cfg, provider) {
    this.vecAvailable = false;
    this.ftsAvailable = false;
    this.dirty = true;
    this.closed = false;
    this.watcher = null;
    this.watchTimer = null;
    this.syncPromise = null;
    this.db = db;
    this.cfg = cfg;
    this.provider = provider;
  }
  // ── Factory ─────────────────────────────────────────────────────────────────
  static async create(cfg) {
    await import_promises2.default.mkdir(import_node_path2.default.dirname(cfg.dbPath), { recursive: true });
    const db = new import_better_sqlite3.default(cfg.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    let vecLoaded = false;
    try {
      const sqliteVec = require("sqlite-vec");
      sqliteVec.load(db);
      vecLoaded = true;
    } catch {
    }
    db.exec(CREATE_TABLES_SQL);
    let ftsAvailable = false;
    try {
      db.exec(CREATE_FTS_SQL);
      ftsAvailable = true;
    } catch {
    }
    const provider = await createEmbeddingProvider(cfg.embedding);
    let vecAvailable = false;
    if (vecLoaded && provider.dimensions > 0) {
      try {
        db.exec(createVecTableSQL(provider.dimensions));
        vecAvailable = true;
      } catch {
      }
    }
    db.exec(SET_SCHEMA_VERSION_SQL);
    const resolved = resolveConfig(cfg);
    const mgr = new _SqliteMemoryManager(db, resolved, provider);
    mgr.vecAvailable = vecAvailable;
    mgr.ftsAvailable = ftsAvailable;
    mgr.startWatcher();
    return mgr;
  }
  // ── Search ─────────────────────────────────────────────────────────────────
  async search(query, opts = {}) {
    if (this.dirty) await this.sync({ reason: "search" });
    const maxResults = opts.maxResults ?? this.cfg.search.maxResults;
    const minScore = opts.minScore ?? this.cfg.search.minScore;
    const { vectorWeight, textWeight } = this.cfg.search;
    const [vectorRows, keywordRows] = await Promise.all([
      this.vectorSearch(query, maxResults * 2),
      this.keywordSearch(query, maxResults * 2)
    ]);
    let merged = mergeResults(vectorRows, keywordRows, {
      vector: vectorWeight,
      text: textWeight
    });
    if (this.cfg.search.temporalDecay.enabled) {
      merged = applyTemporalDecay(
        merged,
        this.cfg.search.temporalDecay.halfLifeDays
      );
    }
    if (this.cfg.search.mmr.enabled) {
      merged = applyMMR(merged, this.cfg.search.mmr.lambda, maxResults);
    } else {
      merged = merged.slice(0, maxResults);
    }
    return merged.filter((r) => r.finalScore >= minScore).map((r) => ({
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      score: r.finalScore,
      snippet: r.text.slice(0, SNIPPET_MAX_CHARS),
      source: r.source
    }));
  }
  // Vector search using sqlite-vec (cosine distance), with JS fallback
  async vectorSearch(query, limit) {
    if (!this.vecAvailable || this.provider.dimensions === 0) return [];
    let queryVecs;
    try {
      queryVecs = await this.embedWithRetry([query]);
    } catch {
      return [];
    }
    const queryVec = queryVecs[0];
    if (!queryVec?.length) return [];
    try {
      const rows = this.db.prepare(
        `
        SELECT c.id, c.path, c.source, c.start_line, c.end_line, c.text,
               vec_distance_cosine(v.embedding, ?) AS dist
          FROM chunks_vec v
          JOIN chunks c ON c.id = v.id
         WHERE c.model = ?
         ORDER BY dist ASC
         LIMIT ?
      `
      ).all(JSON.stringify(queryVec), this.provider.model, limit);
      return rows.map((r) => ({
        id: r.id,
        path: r.path,
        source: r.source,
        startLine: r.start_line,
        endLine: r.end_line,
        text: r.text,
        score: Math.max(0, 1 - r.dist)
      }));
    } catch {
      return this.vectorSearchFallback(queryVec, limit);
    }
  }
  // In-memory cosine similarity fallback (slower but always works)
  vectorSearchFallback(queryVec, limit) {
    const rows = this.db.prepare(
      "SELECT id, path, source, start_line, end_line, text, embedding FROM chunks WHERE model = ?"
    ).all(this.provider.model);
    return rows.map((r) => {
      let emb;
      try {
        emb = JSON.parse(r.embedding);
      } catch {
        return null;
      }
      const score = cosineSimilarity(queryVec, emb);
      return {
        id: r.id,
        path: r.path,
        source: r.source,
        startLine: r.start_line,
        endLine: r.end_line,
        text: r.text,
        score
      };
    }).filter((r) => r !== null).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  // BM25 full-text search via FTS5
  keywordSearch(query, limit) {
    if (!this.ftsAvailable) return [];
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];
    try {
      const rows = this.db.prepare(
        `
        SELECT id, path, source, start_line, end_line, text, bm25(chunks_fts) AS rank
          FROM chunks_fts
         WHERE chunks_fts MATCH ?
         ORDER BY rank ASC
         LIMIT ?
      `
      ).all(ftsQuery, limit);
      return rows.map((r) => ({
        id: r.id,
        path: r.path,
        source: r.source,
        startLine: r.start_line,
        endLine: r.end_line,
        text: r.text,
        score: 0,
        rank: r.rank
      }));
    } catch {
      return [];
    }
  }
  // ── Sync ───────────────────────────────────────────────────────────────────
  async sync(params = {}) {
    if (!this.dirty && !params.force) return;
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.doSync(params).finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }
  async doSync(params) {
    this.dirty = false;
    const files = await this.listMemoryFiles();
    const activePaths = new Set(files.map((f) => f.relPath));
    let completed = 0;
    const batches = chunk(files, 4);
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (f) => {
          await this.indexFileIfChanged(f.absPath, f.relPath, "memory");
          params.progress?.({
            completed: ++completed,
            total: files.length,
            label: f.relPath
          });
        })
      );
    }
    this.deleteStale(activePaths, "memory");
  }
  async indexFileIfChanged(absPath, relPath, source) {
    let stat;
    try {
      stat = await import_promises2.default.stat(absPath);
    } catch {
      return;
    }
    const content = await import_promises2.default.readFile(absPath, "utf-8");
    const hash = sha256(content);
    const existing = this.db.prepare("SELECT hash FROM files WHERE path = ? AND source = ?").get(relPath, source);
    if (existing?.hash === hash) return;
    const chunks = chunkText2(content, relPath, source, this.cfg.chunking);
    await this.upsertChunks(chunks);
    this.db.prepare(
      "INSERT OR REPLACE INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)"
    ).run(relPath, source, hash, stat.mtimeMs, stat.size);
  }
  async upsertChunks(chunks) {
    if (chunks.length === 0) return;
    const embeddings = this.provider.dimensions > 0 ? await this.batchEmbed(chunks.map((c) => c.text)) : chunks.map(() => []);
    const now = Date.now();
    const model = this.provider.model;
    this.db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const embJson = JSON.stringify(embeddings[i] ?? []);
        this.db.prepare(
          `
          INSERT OR REPLACE INTO chunks
            (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          c.id,
          c.path,
          c.source,
          c.startLine,
          c.endLine,
          c.hash,
          model,
          c.text,
          embJson,
          now
        );
        if (this.vecAvailable && embeddings[i]?.length) {
          try {
            this.db.prepare(
              "INSERT OR REPLACE INTO chunks_vec (id, embedding) VALUES (?, ?)"
            ).run(c.id, embJson);
          } catch {
          }
        }
        if (this.ftsAvailable) {
          try {
            this.db.prepare(
              `
              INSERT OR REPLACE INTO chunks_fts
                (text, id, path, source, model, start_line, end_line)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `
            ).run(
              c.text,
              c.id,
              c.path,
              c.source,
              model,
              c.startLine,
              c.endLine
            );
          } catch {
          }
        }
      }
    })();
  }
  // Remove chunks whose source files have been deleted
  deleteStale(activePaths, source) {
    const indexed = this.db.prepare("SELECT DISTINCT path FROM files WHERE source = ?").all(source).map((r) => r.path);
    for (const p of indexed) {
      if (activePaths.has(p)) continue;
      const ids = this.db.prepare("SELECT id FROM chunks WHERE path = ? AND source = ?").all(p, source).map((r) => r.id);
      this.db.transaction(() => {
        for (const id of ids) {
          if (this.vecAvailable) {
            try {
              this.db.prepare("DELETE FROM chunks_vec WHERE id = ?").run(id);
            } catch {
            }
          }
          if (this.ftsAvailable) {
            try {
              this.db.prepare("DELETE FROM chunks_fts WHERE id = ?").run(id);
            } catch {
            }
          }
        }
        this.db.prepare("DELETE FROM chunks WHERE path = ? AND source = ?").run(p, source);
        this.db.prepare("DELETE FROM files WHERE path = ? AND source = ?").run(p, source);
      })();
    }
  }
  // ── File discovery ─────────────────────────────────────────────────────────
  async listMemoryFiles() {
    const results = [];
    const seen = /* @__PURE__ */ new Set();
    const ws = this.cfg.workspaceDir;
    const add = (abs, rel) => {
      if (!seen.has(abs)) {
        seen.add(abs);
        results.push({ absPath: abs, relPath: rel });
      }
    };
    for (const name of ["MEMORY.md", "memory.md"]) {
      const abs = import_node_path2.default.join(ws, name);
      try {
        await import_promises2.default.access(abs);
        add(abs, name);
      } catch {
      }
    }
    await walkMd(import_node_path2.default.join(ws, "memory"), "memory", add);
    for (const extra of this.cfg.extraPaths) {
      const absExtra = import_node_path2.default.isAbsolute(extra) ? extra : import_node_path2.default.join(ws, extra);
      await walkMd(absExtra, import_node_path2.default.relative(ws, absExtra), add);
    }
    return results;
  }
  // ── File watching ──────────────────────────────────────────────────────────
  startWatcher() {
    const ws = this.cfg.workspaceDir;
    const patterns = [
      import_node_path2.default.join(ws, "MEMORY.md"),
      import_node_path2.default.join(ws, "memory.md"),
      import_node_path2.default.join(ws, "memory", "**", "*.md"),
      ...this.cfg.extraPaths.map(
        (p) => import_node_path2.default.isAbsolute(p) ? import_node_path2.default.join(p, "**", "*.md") : import_node_path2.default.join(ws, p, "**", "*.md")
      )
    ];
    this.watcher = import_chokidar.default.watch(patterns, {
      ignoreInitial: true,
      ignored: /(node_modules|\.git)/
    });
    const markDirty = () => {
      if (this.watchTimer) clearTimeout(this.watchTimer);
      this.watchTimer = setTimeout(() => {
        this.dirty = true;
      }, this.cfg.sync.watchDebounceMs);
    };
    this.watcher.on("add", markDirty).on("change", markDirty).on("unlink", markDirty);
  }
  // ── Embedding with batching and retry ──────────────────────────────────────
  async batchEmbed(texts) {
    const batches = [];
    let current = [];
    let acc = 0;
    for (const t of texts) {
      const bytes = Buffer.byteLength(t, "utf8");
      if (acc + bytes > EMBED_BATCH_MAX_BYTES && current.length > 0) {
        batches.push(current);
        current = [];
        acc = 0;
      }
      current.push(t);
      acc += bytes;
    }
    if (current.length > 0) batches.push(current);
    const results = [];
    for (const batch of batches) {
      const embs = await this.embedWithRetry(batch);
      results.push(...embs);
    }
    return results;
  }
  // Exponential backoff retry for transient API failures
  async embedWithRetry(texts) {
    let delay = RETRY_BASE_MS;
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      try {
        return await this.provider.embed(texts);
      } catch (err) {
        if (attempt === RETRY_ATTEMPTS - 1) throw err;
        await sleep(delay * (1 + Math.random() * 0.2));
        delay = Math.min(delay * 2, 8e3);
      }
    }
    throw new Error("unreachable");
  }
  // ── readFile ───────────────────────────────────────────────────────────────
  async readFile(params) {
    const rel = normalizePath(params.relPath);
    if (!isMemoryPath(rel))
      throw new Error(`Not a valid memory path: "${rel}"`);
    const abs = import_node_path2.default.join(this.cfg.workspaceDir, rel);
    const content = await import_promises2.default.readFile(abs, "utf-8");
    if (params.from === void 0) return { text: content, path: rel };
    const lines = content.split("\n");
    const start = Math.max(0, params.from - 1);
    const end = params.lines ? start + params.lines : lines.length;
    return { text: lines.slice(start, end).join("\n"), path: rel };
  }
  // ── Status ─────────────────────────────────────────────────────────────────
  status() {
    const files = this.db.prepare("SELECT COUNT(*) AS n FROM files").get().n;
    const chunks = this.db.prepare("SELECT COUNT(*) AS n FROM chunks").get().n;
    return {
      backend: "builtin",
      provider: this.provider.id,
      model: this.provider.model,
      files,
      chunks,
      dirty: this.dirty,
      workspaceDir: this.cfg.workspaceDir,
      dbPath: this.cfg.dbPath,
      sources: ["memory"],
      vector: {
        enabled: this.provider.dimensions > 0,
        available: this.vecAvailable
      }
    };
  }
  // ── Close ──────────────────────────────────────────────────────────────────
  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.watchTimer) clearTimeout(this.watchTimer);
    await this.watcher?.close();
    await this.syncPromise?.catch(() => {
    });
    this.db.close();
  }
};
function resolveConfig(cfg) {
  return {
    workspaceDir: cfg.workspaceDir,
    dbPath: cfg.dbPath,
    chunking: { tokens: 400, overlap: 80, ...cfg.chunking },
    search: {
      maxResults: 6,
      minScore: 0,
      vectorWeight: 0.7,
      textWeight: 0.3,
      mmr: { enabled: false, lambda: 0.7, ...cfg.search?.mmr },
      temporalDecay: {
        enabled: false,
        halfLifeDays: 30,
        ...cfg.search?.temporalDecay
      },
      ...cfg.search
    },
    sync: { watchDebounceMs: 1500, ...cfg.sync },
    extraPaths: cfg.extraPaths ?? []
  };
}
async function walkMd(dir, relPrefix, add) {
  try {
    for (const entry of await import_promises2.default.readdir(dir, { withFileTypes: true })) {
      const rel = `${relPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walkMd(import_node_path2.default.join(dir, entry.name), rel, add);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        add(import_node_path2.default.join(dir, entry.name), rel);
      }
    }
  } catch {
  }
}
function normalizePath(value) {
  return value.trim().replace(/^[./]+/, "").replace(/\\/g, "/");
}
function isMemoryPath(rel) {
  return rel === "MEMORY.md" || rel === "memory.md" || rel.startsWith("memory/");
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// electron/integrations/mosaicbot/src/main/memory/qmd-backend.ts
var import_node_child_process2 = require("node:child_process");
var import_node_path3 = __toESM(require("node:path"));
var import_promises3 = __toESM(require("node:fs/promises"));
var import_better_sqlite32 = __toESM(require("better-sqlite3"));
var MAX_STDOUT_BYTES = 2e5;
var QmdMemoryManager = class _QmdMemoryManager {
  constructor(cfg, collections) {
    // qmd's own SQLite index
    this.db = null;
    this.updateTimer = null;
    this.pendingUpdate = null;
    this.lastUpdateAt = null;
    this.closed = false;
    this.cfg = cfg;
    this.collections = collections;
    const agentQmdDir = import_node_path3.default.join(cfg.stateDir, "agents", cfg.agentId, "qmd");
    this.xdgConfigHome = import_node_path3.default.join(agentQmdDir, "xdg-config");
    this.xdgCacheHome = import_node_path3.default.join(agentQmdDir, "xdg-cache");
    this.indexPath = import_node_path3.default.join(this.xdgCacheHome, "qmd", "index.sqlite");
  }
  // ── Factory ─────────────────────────────────────────────────────────────────
  /**
   * Returns null if the `qmd` binary is unavailable, so callers can fall back
   * to the builtin SQLite backend without throwing.
   */
  static async create(cfg) {
    const resolved = resolveQmdConfig(cfg);
    const collections = [
      // Default: index the whole workspace for *.md files
      { path: cfg.workspaceDir, name: "memory-root", pattern: "**/*.md" },
      ...resolved.paths.map((p, i) => ({
        path: import_node_path3.default.isAbsolute(p.path) ? p.path : import_node_path3.default.join(cfg.workspaceDir, p.path),
        name: p.name ?? `custom-${i}`,
        pattern: p.pattern ?? "**/*.md"
      }))
    ];
    const agentQmdDir = import_node_path3.default.join(
      resolved.stateDir,
      "agents",
      resolved.agentId,
      "qmd"
    );
    const xdgConfigHome = import_node_path3.default.join(agentQmdDir, "xdg-config");
    const xdgCacheHome = import_node_path3.default.join(agentQmdDir, "xdg-cache");
    try {
      await runQmdCommand(resolved.command, ["--version"], {
        xdgConfigHome,
        xdgCacheHome,
        workspaceDir: cfg.workspaceDir,
        timeoutMs: 5e3
      });
    } catch {
      return null;
    }
    const manager = new _QmdMemoryManager(resolved, collections);
    await manager.initialize();
    return manager;
  }
  async initialize() {
    await import_promises3.default.mkdir(this.xdgConfigHome, { recursive: true });
    await import_promises3.default.mkdir(import_node_path3.default.join(this.xdgCacheHome, "qmd"), { recursive: true });
    await symlinkSharedModels(this.xdgCacheHome);
    await this.ensureCollections();
    if (this.cfg.update.onBoot) {
      this.pendingUpdate = this.runUpdate("boot", true).finally(() => {
        this.pendingUpdate = null;
      });
    }
    if (this.cfg.update.intervalMs > 0) {
      this.updateTimer = setInterval(() => {
        if (!this.pendingUpdate) {
          this.pendingUpdate = this.runUpdate("interval", false).finally(() => {
            this.pendingUpdate = null;
          });
        }
      }, this.cfg.update.intervalMs);
      this.updateTimer.unref?.();
    }
  }
  // ── Search ─────────────────────────────────────────────────────────────────
  async search(query, opts = {}) {
    if (this.pendingUpdate) {
      await Promise.race([this.pendingUpdate, sleep2(500)]);
    }
    const maxResults = opts.maxResults ?? this.cfg.limits.maxResults;
    const args = buildSearchArgs(
      this.cfg.searchMode,
      query,
      maxResults,
      this.collections.map((c) => c.name)
    );
    const { stdout } = await runQmdCommand(this.cfg.command, args, {
      xdgConfigHome: this.xdgConfigHome,
      xdgCacheHome: this.xdgCacheHome,
      workspaceDir: this.cfg.workspaceDir,
      timeoutMs: this.cfg.limits.timeoutMs
    });
    const raw = parseQmdJson(stdout);
    return raw.slice(0, maxResults).map((r) => this.resolveResult(r)).filter((r) => r !== null);
  }
  resolveResult(r) {
    const score = r.score ?? 0;
    const { startLine, endLine } = extractLineNumbers(r.snippet ?? "");
    const snippetText = extractSnippetText(r.snippet ?? r.body ?? "");
    let docPath = r.file ?? "";
    if (!docPath && r.docid) {
      docPath = this.lookupDocPath(r.docid) ?? "";
    }
    if (!docPath) return null;
    const relPath = import_node_path3.default.isAbsolute(docPath) ? import_node_path3.default.relative(this.cfg.workspaceDir, docPath) : docPath;
    return {
      path: relPath,
      startLine,
      endLine,
      score,
      snippet: snippetText.slice(0, this.cfg.limits.maxSnippetChars),
      source: "memory"
    };
  }
  // Read-only access to qmd's own index.sqlite to resolve document paths from hashes
  lookupDocPath(docid) {
    if (!this.db) {
      try {
        this.db = new import_better_sqlite32.default(this.indexPath, { readonly: true });
        this.db.pragma("busy_timeout = 1");
      } catch {
        return null;
      }
    }
    try {
      const clean = docid.replace(/^#/, "");
      const row = this.db.prepare(
        "SELECT path FROM documents WHERE hash = ? AND active = 1 LIMIT 1"
      ).get(clean);
      return row?.path ?? null;
    } catch {
      return null;
    }
  }
  // ── Sync ───────────────────────────────────────────────────────────────────
  async sync(params = {}) {
    this.pendingUpdate = this.runUpdate(
      params.reason ?? "manual",
      params.force ?? true
    );
    await this.pendingUpdate;
    this.pendingUpdate = null;
  }
  async runUpdate(reason, embed) {
    try {
      await runQmdCommand(this.cfg.command, ["update"], {
        xdgConfigHome: this.xdgConfigHome,
        xdgCacheHome: this.xdgCacheHome,
        workspaceDir: this.cfg.workspaceDir,
        timeoutMs: this.cfg.update.updateTimeoutMs
      });
      if (embed) {
        await runQmdCommand(this.cfg.command, ["embed"], {
          xdgConfigHome: this.xdgConfigHome,
          xdgCacheHome: this.xdgCacheHome,
          workspaceDir: this.cfg.workspaceDir,
          timeoutMs: this.cfg.update.embedTimeoutMs
        });
      }
      this.lastUpdateAt = Date.now();
    } catch (err) {
      console.warn(`[QMD] update failed (${reason}):`, err);
    }
  }
  // ── Collection management ──────────────────────────────────────────────────
  async ensureCollections() {
    let existing = [];
    try {
      const { stdout } = await runQmdCommand(
        this.cfg.command,
        ["collection", "list", "--json"],
        {
          xdgConfigHome: this.xdgConfigHome,
          xdgCacheHome: this.xdgCacheHome,
          workspaceDir: this.cfg.workspaceDir,
          timeoutMs: 1e4
        }
      );
      const parsed = JSON.parse(stdout || "[]");
      existing = parsed.map((c) => c.name ?? "").filter(Boolean);
    } catch {
    }
    const desired = new Set(this.collections.map((c) => c.name));
    for (const name of existing) {
      if (!desired.has(name)) {
        await runQmdCommand(this.cfg.command, ["collection", "remove", name], {
          xdgConfigHome: this.xdgConfigHome,
          xdgCacheHome: this.xdgCacheHome,
          workspaceDir: this.cfg.workspaceDir,
          timeoutMs: 1e4
        }).catch(() => {
        });
      }
    }
    for (const col of this.collections) {
      if (!existing.includes(col.name)) {
        await runQmdCommand(
          this.cfg.command,
          [
            "collection",
            "add",
            col.path,
            "--name",
            col.name,
            "--mask",
            col.pattern
          ],
          {
            xdgConfigHome: this.xdgConfigHome,
            xdgCacheHome: this.xdgCacheHome,
            workspaceDir: this.cfg.workspaceDir,
            timeoutMs: 1e4
          }
        ).catch(() => {
        });
      }
    }
  }
  // ── readFile ───────────────────────────────────────────────────────────────
  async readFile(params) {
    const rel = params.relPath.trim().replace(/^[./]+/, "").replace(/\\/g, "/");
    const abs = import_node_path3.default.isAbsolute(rel) ? rel : import_node_path3.default.join(this.cfg.workspaceDir, rel);
    const content = await import_promises3.default.readFile(abs, "utf-8");
    if (params.from === void 0) return { text: content, path: rel };
    const lines = content.split("\n");
    const start = Math.max(0, params.from - 1);
    const end = params.lines ? start + params.lines : lines.length;
    return { text: lines.slice(start, end).join("\n"), path: rel };
  }
  // ── Status ─────────────────────────────────────────────────────────────────
  status() {
    let files = 0;
    try {
      if (!this.db) {
        this.db = new import_better_sqlite32.default(this.indexPath, { readonly: true });
        this.db.pragma("busy_timeout = 1");
      }
      const row = this.db.prepare("SELECT COUNT(*) AS n FROM documents WHERE active = 1").get();
      files = row.n;
    } catch {
    }
    return {
      backend: "qmd",
      provider: "qmd",
      model: "qmd",
      files,
      chunks: files,
      dirty: false,
      workspaceDir: this.cfg.workspaceDir,
      dbPath: this.indexPath,
      sources: ["memory"],
      vector: { enabled: true, available: true }
    };
  }
  // ── Close ──────────────────────────────────────────────────────────────────
  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.updateTimer) clearInterval(this.updateTimer);
    await this.pendingUpdate?.catch(() => {
    });
    this.db?.close();
  }
};
function runQmdCommand(command, args, opts) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      XDG_CONFIG_HOME: opts.xdgConfigHome,
      XDG_CACHE_HOME: opts.xdgCacheHome,
      NO_COLOR: "1"
    };
    const proc = (0, import_node_child_process2.spawn)(command, args, { env, cwd: opts.workspaceDir });
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    proc.stdout.on("data", (chunk2) => {
      stdoutBytes += chunk2.length;
      if (stdoutBytes <= MAX_STDOUT_BYTES) stdoutChunks.push(chunk2);
    });
    proc.stderr.on("data", (chunk2) => stderrChunks.push(chunk2));
    const timer2 = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`qmd timed out: ${command} ${args.join(" ")}`));
    }, opts.timeoutMs);
    proc.on("close", (code) => {
      clearTimeout(timer2);
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`qmd exited ${code}: ${stderr.slice(0, 500)}`));
    });
    proc.on("error", (err) => {
      clearTimeout(timer2);
      reject(err);
    });
  });
}
function buildSearchArgs(mode, query, limit, collections) {
  const args = [mode, query, "--json", "-n", String(limit)];
  for (const c of collections) args.push("-c", c);
  return args;
}
function parseQmdJson(stdout) {
  try {
    const parsed = JSON.parse(stdout.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function extractLineNumbers(snippet) {
  const m = snippet.match(/@@ -(\d+),(\d+)/);
  if (!m) return { startLine: 1, endLine: 1 };
  const start = parseInt(m[1], 10);
  const count = parseInt(m[2], 10);
  return { startLine: start, endLine: start + count - 1 };
}
function extractSnippetText(snippet) {
  return snippet.replace(/^@@[^\n]*\n/, "").trim();
}
async function symlinkSharedModels(xdgCacheHome) {
  const sharedModels = import_node_path3.default.join(
    process.env.HOME ?? process.env.USERPROFILE ?? "",
    ".cache",
    "qmd",
    "models"
  );
  const agentModels = import_node_path3.default.join(xdgCacheHome, "qmd", "models");
  try {
    await import_promises3.default.access(agentModels);
    return;
  } catch {
  }
  try {
    await import_promises3.default.mkdir(sharedModels, { recursive: true });
    await import_promises3.default.symlink(sharedModels, agentModels, "dir");
  } catch {
  }
}
function resolveQmdConfig(cfg) {
  return {
    command: cfg.command ?? "qmd",
    searchMode: cfg.searchMode ?? "search",
    paths: cfg.paths ?? [],
    sessions: { enabled: false, retentionDays: 30, ...cfg.sessions },
    update: {
      intervalMs: 5 * 6e4,
      onBoot: true,
      updateTimeoutMs: 12e4,
      embedTimeoutMs: 12e4,
      ...cfg.update
    },
    limits: {
      maxResults: 6,
      maxSnippetChars: 700,
      timeoutMs: 4e3,
      ...cfg.limits
    },
    workspaceDir: cfg.workspaceDir,
    agentId: cfg.agentId,
    stateDir: cfg.stateDir
  };
}
function sleep2(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// electron/integrations/mosaicbot/src/main/memory/index.ts
var cache = /* @__PURE__ */ new Map();
async function getMemoryManager(cfg) {
  const key = JSON.stringify(cfg);
  const existing = cache.get(key);
  if (existing) return existing;
  let manager;
  if (cfg.backend === "builtin") {
    manager = await SqliteMemoryManager.create(cfg.config);
  } else {
    const qmd = await QmdMemoryManager.create(cfg.config);
    if (qmd) {
      const fallbackFactory = cfg.fallback ? () => SqliteMemoryManager.create(cfg.fallback) : void 0;
      manager = fallbackFactory ? new FallbackMemoryManager(
        qmd,
        fallbackFactory,
        () => cache.delete(key)
      ) : qmd;
    } else if (cfg.fallback) {
      console.warn("[Memory] qmd unavailable \u2014 using builtin SQLite backend");
      manager = await SqliteMemoryManager.create(cfg.fallback);
    } else {
      throw new Error("qmd unavailable and no fallback configured");
    }
  }
  cache.set(key, manager);
  return manager;
}
var FallbackMemoryManager = class {
  constructor(primary, fallbackFactory, onEvict) {
    this.primary = primary;
    this.fallbackFactory = fallbackFactory;
    this.onEvict = onEvict;
    this.fallback = null;
    this.primaryFailed = false;
  }
  async search(query, opts) {
    return this.via((m) => m.search(query, opts));
  }
  async readFile(params) {
    return this.via((m) => m.readFile(params));
  }
  async sync(params) {
    return this.via((m) => m.sync(params));
  }
  status() {
    const base = (this.primaryFailed ? this.fallback?.status() : null) ?? this.primary.status();
    return this.primaryFailed ? {
      ...base,
      fallback: { from: "qmd", reason: this.lastError ?? "unknown" }
    } : base;
  }
  async close() {
    await this.primary.close().catch(() => {
    });
    await this.fallback?.close().catch(() => {
    });
  }
  async via(fn) {
    if (!this.primaryFailed) {
      try {
        return await fn(this.primary);
      } catch (err) {
        this.primaryFailed = true;
        this.lastError = String(err);
        console.warn(
          `[Memory] qmd failed \u2014 switching to builtin: ${this.lastError}`
        );
        this.onEvict?.();
        this.primary.close().catch(() => {
        });
      }
    }
    if (!this.fallback) this.fallback = await this.fallbackFactory();
    return fn(this.fallback);
  }
};

// electron/integrations/mosaicbot/src/main/index.ts
var config = {
  channels: {
    ipc: { enabled: true }
    // http: { webhookUrl: "https://your-endpoint/webhook", enabled: true },
  }
};
async function initMosaicBot() {
  const APP_DIR = import_node_path4.default.join(import_electron6.app.getPath("userData"), "mosaicbot");
  const WORKSPACE_DIR = process.cwd();
  registerChannel(ipcChannelPlugin);
  registerChannel(httpChannelPlugin);
  const skillEntries = await loadSkillEntries(defaultSkillSources(APP_DIR, WORKSPACE_DIR));
  const eligibilityCtx = await buildEligibilityContext();
  const skillSnapshot = buildSkillSnapshot(skillEntries, eligibilityCtx);
  console.log(
    `[MosaicBot] ${skillSnapshot.skills.length} skills loaded:`,
    skillSnapshot.commandSpecs.map((s) => `/${s.name}`).join(", ")
  );
  const memory = await getMemoryManager({
    backend: "builtin",
    config: {
      workspaceDir: WORKSPACE_DIR,
      dbPath: import_node_path4.default.join(APP_DIR, "memory", "main.sqlite"),
      // Uncomment to enable vector search:
      // embedding: {
      //   provider: "openai",
      //   apiKey: process.env.OPENAI_API_KEY!,
      // },
      // Or with a local Ollama model:
      // embedding: { provider: "ollama", model: "nomic-embed-text" },
      embedding: { provider: "none" },
      // FTS-only by default
      search: {
        vectorWeight: 0.7,
        textWeight: 0.3,
        temporalDecay: { enabled: true, halfLifeDays: 30 },
        mmr: { enabled: true, lambda: 0.7 }
      }
    }
  });
  const heartbeat = startHeartbeatRunner({
    agents: [
      {
        agentId: "main",
        heartbeat: {
          enabled: true,
          intervalMs: 30 * 6e4,
          channel: "ipc",
          to: "renderer",
          ackMaxChars: 300,
          activeHours: { start: "09:00", end: "22:00" },
          // Search memory before each heartbeat tick and prepend relevant context
          memorySearch: {
            query: "pending tasks actions reminders",
            maxResults: 5,
            maxInjectedChars: 2e3
          }
        }
      }
    ],
    // Replace with your actual LLM call
    onReply: async ({ agentId, now, prompt: _prompt }) => {
      console.log(`[Heartbeat] ${agentId} @ ${now.toISOString()}`);
      return "HEARTBEAT_OK";
    },
    onDeliver: async (_agentId, channel, to, text) => {
      await deliverMessage({ cfg: config, channel, to, text });
    },
    onEvent: (evt) => {
      console.log(`[Heartbeat] ${evt.agentId} \u2192 ${evt.status}`, evt.preview ?? "");
    },
    memory
  });
  import_electron6.ipcMain.handle("agent:send", async (_e, text) => {
    const match = resolveSkillCommand(text, skillSnapshot.commandSpecs);
    if (match) {
      console.log(`[Skill] ${match.spec.skillName}`, match.args);
      return { type: "skill", skill: match.spec.skillName, args: match.args };
    }
    return { type: "message", text };
  });
  import_electron6.ipcMain.handle("memory:search", async (_e, query, opts) => {
    return memory.search(query, opts);
  });
  import_electron6.ipcMain.handle("memory:read", async (_e, relPath, from, lines) => {
    return memory.readFile({ relPath, from, lines });
  });
  import_electron6.ipcMain.handle("memory:sync", async () => {
    await memory.sync({ reason: "manual", force: true });
    return memory.status();
  });
  import_electron6.ipcMain.handle("memory:status", () => memory.status());
  import_electron6.ipcMain.handle("heartbeat:trigger", (_e, agentId) => {
    requestHeartbeatNow({ agentId, reason: "action", priority: 3 });
    return { ok: true };
  });
  import_electron6.ipcMain.handle(
    "skills:list",
    () => skillSnapshot.commandSpecs.map((s) => ({ name: s.name, description: s.description }))
  );
  return {
    async stop() {
      heartbeat.stop();
      await memory.close();
    }
  };
}

// electron/main.ts
var import_module = require("module");

// electron/integrations/gmail/index.ts
var import_googleapis = require("googleapis");
var import_http2 = __toESM(require("http"));
var import_url = require("url");

// node_modules/open/index.js
var import_node_process7 = __toESM(require("node:process"), 1);
var import_node_path5 = __toESM(require("node:path"), 1);
var import_node_url = require("node:url");
var import_node_child_process9 = __toESM(require("node:child_process"), 1);
var import_promises5 = __toESM(require("node:fs/promises"), 1);

// node_modules/wsl-utils/index.js
var import_node_util3 = require("node:util");
var import_node_child_process4 = __toESM(require("node:child_process"), 1);
var import_promises4 = __toESM(require("node:fs/promises"), 1);

// node_modules/is-wsl/index.js
var import_node_process = __toESM(require("node:process"), 1);
var import_node_os2 = __toESM(require("node:os"), 1);
var import_node_fs3 = __toESM(require("node:fs"), 1);

// node_modules/is-inside-container/index.js
var import_node_fs2 = __toESM(require("node:fs"), 1);

// node_modules/is-docker/index.js
var import_node_fs = __toESM(require("node:fs"), 1);
var isDockerCached;
function hasDockerEnv() {
  try {
    import_node_fs.default.statSync("/.dockerenv");
    return true;
  } catch {
    return false;
  }
}
function hasDockerCGroup() {
  try {
    return import_node_fs.default.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
  } catch {
    return false;
  }
}
function isDocker() {
  if (isDockerCached === void 0) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup();
  }
  return isDockerCached;
}

// node_modules/is-inside-container/index.js
var cachedResult;
var hasContainerEnv = () => {
  try {
    import_node_fs2.default.statSync("/run/.containerenv");
    return true;
  } catch {
    return false;
  }
};
function isInsideContainer() {
  if (cachedResult === void 0) {
    cachedResult = hasContainerEnv() || isDocker();
  }
  return cachedResult;
}

// node_modules/is-wsl/index.js
var isWsl = () => {
  if (import_node_process.default.platform !== "linux") {
    return false;
  }
  if (import_node_os2.default.release().toLowerCase().includes("microsoft")) {
    if (isInsideContainer()) {
      return false;
    }
    return true;
  }
  try {
    return import_node_fs3.default.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft") ? !isInsideContainer() : false;
  } catch {
    return false;
  }
};
var is_wsl_default = import_node_process.default.env.__IS_WSL_TEST__ ? isWsl : isWsl();

// node_modules/powershell-utils/index.js
var import_node_process2 = __toESM(require("node:process"), 1);
var import_node_buffer = require("node:buffer");
var import_node_util2 = require("node:util");
var import_node_child_process3 = __toESM(require("node:child_process"), 1);
var execFile2 = (0, import_node_util2.promisify)(import_node_child_process3.default.execFile);
var powerShellPath = () => `${import_node_process2.default.env.SYSTEMROOT || import_node_process2.default.env.windir || String.raw`C:\Windows`}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
var executePowerShell = async (command, options = {}) => {
  const {
    powerShellPath: psPath,
    ...execFileOptions
  } = options;
  const encodedCommand = executePowerShell.encodeCommand(command);
  return execFile2(
    psPath ?? powerShellPath(),
    [
      ...executePowerShell.argumentsPrefix,
      encodedCommand
    ],
    {
      encoding: "utf8",
      ...execFileOptions
    }
  );
};
executePowerShell.argumentsPrefix = [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-EncodedCommand"
];
executePowerShell.encodeCommand = (command) => import_node_buffer.Buffer.from(command, "utf16le").toString("base64");
executePowerShell.escapeArgument = (value) => `'${String(value).replaceAll("'", "''")}'`;

// node_modules/wsl-utils/utilities.js
function parseMountPointFromConfig(content) {
  for (const line of content.split("\n")) {
    if (/^\s*#/.test(line)) {
      continue;
    }
    const match = /^\s*root\s*=\s*(?<mountPoint>"[^"]*"|'[^']*'|[^#]*)/.exec(line);
    if (!match) {
      continue;
    }
    return match.groups.mountPoint.trim().replaceAll(/^["']|["']$/g, "");
  }
}

// node_modules/wsl-utils/index.js
var execFile3 = (0, import_node_util3.promisify)(import_node_child_process4.default.execFile);
var wslDrivesMountPoint = /* @__PURE__ */ (() => {
  const defaultMountPoint = "/mnt/";
  let mountPoint;
  return async function() {
    if (mountPoint) {
      return mountPoint;
    }
    const configFilePath = "/etc/wsl.conf";
    let isConfigFileExists = false;
    try {
      await import_promises4.default.access(configFilePath, import_promises4.constants.F_OK);
      isConfigFileExists = true;
    } catch {
    }
    if (!isConfigFileExists) {
      return defaultMountPoint;
    }
    const configContent = await import_promises4.default.readFile(configFilePath, { encoding: "utf8" });
    const parsedMountPoint = parseMountPointFromConfig(configContent);
    if (parsedMountPoint === void 0) {
      return defaultMountPoint;
    }
    mountPoint = parsedMountPoint;
    mountPoint = mountPoint.endsWith("/") ? mountPoint : `${mountPoint}/`;
    return mountPoint;
  };
})();
var powerShellPathFromWsl = async () => {
  const mountPoint = await wslDrivesMountPoint();
  return `${mountPoint}c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`;
};
var powerShellPath2 = is_wsl_default ? powerShellPathFromWsl : powerShellPath;
var canAccessPowerShellPromise;
var canAccessPowerShell = async () => {
  canAccessPowerShellPromise ??= (async () => {
    try {
      const psPath = await powerShellPath2();
      await import_promises4.default.access(psPath, import_promises4.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  })();
  return canAccessPowerShellPromise;
};
var wslDefaultBrowser = async () => {
  const psPath = await powerShellPath2();
  const command = String.raw`(Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice").ProgId`;
  const { stdout } = await executePowerShell(command, { powerShellPath: psPath });
  return stdout.trim();
};
var convertWslPathToWindows = async (path12) => {
  if (/^[a-z]+:\/\//i.test(path12)) {
    return path12;
  }
  try {
    const { stdout } = await execFile3("wslpath", ["-aw", path12], { encoding: "utf8" });
    return stdout.trim();
  } catch {
    return path12;
  }
};

// node_modules/define-lazy-prop/index.js
function defineLazyProperty(object, propertyName, valueGetter) {
  const define = (value) => Object.defineProperty(object, propertyName, { value, enumerable: true, writable: true });
  Object.defineProperty(object, propertyName, {
    configurable: true,
    enumerable: true,
    get() {
      const result = valueGetter();
      define(result);
      return result;
    },
    set(value) {
      define(value);
    }
  });
  return object;
}

// node_modules/default-browser/index.js
var import_node_util7 = require("node:util");
var import_node_process5 = __toESM(require("node:process"), 1);
var import_node_child_process8 = require("node:child_process");

// node_modules/default-browser-id/index.js
var import_node_util4 = require("node:util");
var import_node_process3 = __toESM(require("node:process"), 1);
var import_node_child_process5 = require("node:child_process");
var execFileAsync2 = (0, import_node_util4.promisify)(import_node_child_process5.execFile);
async function defaultBrowserId() {
  if (import_node_process3.default.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const { stdout } = await execFileAsync2("defaults", ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"]);
  const match = /LSHandlerRoleAll = "(?!-)(?<id>[^"]+?)";\s+?LSHandlerURLScheme = (?:http|https);/.exec(stdout);
  const browserId = match?.groups.id ?? "com.apple.Safari";
  if (browserId === "com.apple.safari") {
    return "com.apple.Safari";
  }
  return browserId;
}

// node_modules/run-applescript/index.js
var import_node_process4 = __toESM(require("node:process"), 1);
var import_node_util5 = require("node:util");
var import_node_child_process6 = require("node:child_process");
var execFileAsync3 = (0, import_node_util5.promisify)(import_node_child_process6.execFile);
async function runAppleScript(script, { humanReadableOutput = true, signal } = {}) {
  if (import_node_process4.default.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const outputArguments = humanReadableOutput ? [] : ["-ss"];
  const execOptions = {};
  if (signal) {
    execOptions.signal = signal;
  }
  const { stdout } = await execFileAsync3("osascript", ["-e", script, outputArguments], execOptions);
  return stdout.trim();
}

// node_modules/bundle-name/index.js
async function bundleName(bundleId) {
  return runAppleScript(`tell application "Finder" to set app_path to application file id "${bundleId}" as string
tell application "System Events" to get value of property list item "CFBundleName" of property list file (app_path & ":Contents:Info.plist")`);
}

// node_modules/default-browser/windows.js
var import_node_util6 = require("node:util");
var import_node_child_process7 = require("node:child_process");
var execFileAsync4 = (0, import_node_util6.promisify)(import_node_child_process7.execFile);
var windowsBrowserProgIds = {
  MSEdgeHTM: { name: "Edge", id: "com.microsoft.edge" },
  // The missing `L` is correct.
  MSEdgeBHTML: { name: "Edge Beta", id: "com.microsoft.edge.beta" },
  MSEdgeDHTML: { name: "Edge Dev", id: "com.microsoft.edge.dev" },
  AppXq0fevzme2pys62n3e0fbqa7peapykr8v: { name: "Edge", id: "com.microsoft.edge.old" },
  ChromeHTML: { name: "Chrome", id: "com.google.chrome" },
  ChromeBHTML: { name: "Chrome Beta", id: "com.google.chrome.beta" },
  ChromeDHTML: { name: "Chrome Dev", id: "com.google.chrome.dev" },
  ChromiumHTM: { name: "Chromium", id: "org.chromium.Chromium" },
  BraveHTML: { name: "Brave", id: "com.brave.Browser" },
  BraveBHTML: { name: "Brave Beta", id: "com.brave.Browser.beta" },
  BraveDHTML: { name: "Brave Dev", id: "com.brave.Browser.dev" },
  BraveSSHTM: { name: "Brave Nightly", id: "com.brave.Browser.nightly" },
  FirefoxURL: { name: "Firefox", id: "org.mozilla.firefox" },
  OperaStable: { name: "Opera", id: "com.operasoftware.Opera" },
  VivaldiHTM: { name: "Vivaldi", id: "com.vivaldi.Vivaldi" },
  "IE.HTTP": { name: "Internet Explorer", id: "com.microsoft.ie" }
};
var _windowsBrowserProgIdMap = new Map(Object.entries(windowsBrowserProgIds));
var UnknownBrowserError = class extends Error {
};
async function defaultBrowser(_execFileAsync = execFileAsync4) {
  const { stdout } = await _execFileAsync("reg", [
    "QUERY",
    " HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
    "/v",
    "ProgId"
  ]);
  const match = /ProgId\s*REG_SZ\s*(?<id>\S+)/.exec(stdout);
  if (!match) {
    throw new UnknownBrowserError(`Cannot find Windows browser in stdout: ${JSON.stringify(stdout)}`);
  }
  const { id } = match.groups;
  const browser = windowsBrowserProgIds[id];
  if (!browser) {
    throw new UnknownBrowserError(`Unknown browser ID: ${id}`);
  }
  return browser;
}

// node_modules/default-browser/index.js
var execFileAsync5 = (0, import_node_util7.promisify)(import_node_child_process8.execFile);
var titleize = (string) => string.toLowerCase().replaceAll(/(?:^|\s|-)\S/g, (x) => x.toUpperCase());
async function defaultBrowser2() {
  if (import_node_process5.default.platform === "darwin") {
    const id = await defaultBrowserId();
    const name = await bundleName(id);
    return { name, id };
  }
  if (import_node_process5.default.platform === "linux") {
    const { stdout } = await execFileAsync5("xdg-mime", ["query", "default", "x-scheme-handler/http"]);
    const id = stdout.trim();
    const name = titleize(id.replace(/.desktop$/, "").replace("-", " "));
    return { name, id };
  }
  if (import_node_process5.default.platform === "win32") {
    return defaultBrowser();
  }
  throw new Error("Only macOS, Linux, and Windows are supported");
}

// node_modules/is-in-ssh/index.js
var import_node_process6 = __toESM(require("node:process"), 1);
var isInSsh = Boolean(import_node_process6.default.env.SSH_CONNECTION || import_node_process6.default.env.SSH_CLIENT || import_node_process6.default.env.SSH_TTY);
var is_in_ssh_default = isInSsh;

// node_modules/open/index.js
var import_meta = {};
var fallbackAttemptSymbol = /* @__PURE__ */ Symbol("fallbackAttempt");
var __dirname2 = import_meta.url ? import_node_path5.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url)) : "";
var localXdgOpenPath = import_node_path5.default.join(__dirname2, "xdg-open");
var { platform, arch } = import_node_process7.default;
var tryEachApp = async (apps2, opener) => {
  if (apps2.length === 0) {
    return;
  }
  const errors = [];
  for (const app8 of apps2) {
    try {
      return await opener(app8);
    } catch (error) {
      errors.push(error);
    }
  }
  throw new AggregateError(errors, "Failed to open in all supported apps");
};
var baseOpen = async (options) => {
  options = {
    wait: false,
    background: false,
    newInstance: false,
    allowNonzeroExitCode: false,
    ...options
  };
  const isFallbackAttempt = options[fallbackAttemptSymbol] === true;
  delete options[fallbackAttemptSymbol];
  if (Array.isArray(options.app)) {
    return tryEachApp(options.app, (singleApp) => baseOpen({
      ...options,
      app: singleApp,
      [fallbackAttemptSymbol]: true
    }));
  }
  let { name: app8, arguments: appArguments = [] } = options.app ?? {};
  appArguments = [...appArguments];
  if (Array.isArray(app8)) {
    return tryEachApp(app8, (appName) => baseOpen({
      ...options,
      app: {
        name: appName,
        arguments: appArguments
      },
      [fallbackAttemptSymbol]: true
    }));
  }
  if (app8 === "browser" || app8 === "browserPrivate") {
    const ids = {
      "com.google.chrome": "chrome",
      "google-chrome.desktop": "chrome",
      "com.brave.browser": "brave",
      "org.mozilla.firefox": "firefox",
      "firefox.desktop": "firefox",
      "com.microsoft.msedge": "edge",
      "com.microsoft.edge": "edge",
      "com.microsoft.edgemac": "edge",
      "microsoft-edge.desktop": "edge",
      "com.apple.safari": "safari"
    };
    const flags = {
      chrome: "--incognito",
      brave: "--incognito",
      firefox: "--private-window",
      edge: "--inPrivate"
      // Safari doesn't support private mode via command line
    };
    let browser;
    if (is_wsl_default) {
      const progId = await wslDefaultBrowser();
      const browserInfo = _windowsBrowserProgIdMap.get(progId);
      browser = browserInfo ?? {};
    } else {
      browser = await defaultBrowser2();
    }
    if (browser.id in ids) {
      const browserName = ids[browser.id.toLowerCase()];
      if (app8 === "browserPrivate") {
        if (browserName === "safari") {
          throw new Error("Safari doesn't support opening in private mode via command line");
        }
        appArguments.push(flags[browserName]);
      }
      return baseOpen({
        ...options,
        app: {
          name: apps[browserName],
          arguments: appArguments
        }
      });
    }
    throw new Error(`${browser.name} is not supported as a default browser`);
  }
  let command;
  const cliArguments = [];
  const childProcessOptions = {};
  let shouldUseWindowsInWsl = false;
  if (is_wsl_default && !isInsideContainer() && !is_in_ssh_default && !app8) {
    shouldUseWindowsInWsl = await canAccessPowerShell();
  }
  if (platform === "darwin") {
    command = "open";
    if (options.wait) {
      cliArguments.push("--wait-apps");
    }
    if (options.background) {
      cliArguments.push("--background");
    }
    if (options.newInstance) {
      cliArguments.push("--new");
    }
    if (app8) {
      cliArguments.push("-a", app8);
    }
  } else if (platform === "win32" || shouldUseWindowsInWsl) {
    command = await powerShellPath2();
    cliArguments.push(...executePowerShell.argumentsPrefix);
    if (!is_wsl_default) {
      childProcessOptions.windowsVerbatimArguments = true;
    }
    if (is_wsl_default && options.target) {
      options.target = await convertWslPathToWindows(options.target);
    }
    const encodedArguments = ["$ProgressPreference = 'SilentlyContinue';", "Start"];
    if (options.wait) {
      encodedArguments.push("-Wait");
    }
    if (app8) {
      encodedArguments.push(executePowerShell.escapeArgument(app8));
      if (options.target) {
        appArguments.push(options.target);
      }
    } else if (options.target) {
      encodedArguments.push(executePowerShell.escapeArgument(options.target));
    }
    if (appArguments.length > 0) {
      appArguments = appArguments.map((argument) => executePowerShell.escapeArgument(argument));
      encodedArguments.push("-ArgumentList", appArguments.join(","));
    }
    options.target = executePowerShell.encodeCommand(encodedArguments.join(" "));
    if (!options.wait) {
      childProcessOptions.stdio = "ignore";
    }
  } else {
    if (app8) {
      command = app8;
    } else {
      const isBundled = !__dirname2 || __dirname2 === "/";
      let exeLocalXdgOpen = false;
      try {
        await import_promises5.default.access(localXdgOpenPath, import_promises5.constants.X_OK);
        exeLocalXdgOpen = true;
      } catch {
      }
      const useSystemXdgOpen = import_node_process7.default.versions.electron ?? (platform === "android" || isBundled || !exeLocalXdgOpen);
      command = useSystemXdgOpen ? "xdg-open" : localXdgOpenPath;
    }
    if (appArguments.length > 0) {
      cliArguments.push(...appArguments);
    }
    if (!options.wait) {
      childProcessOptions.stdio = "ignore";
      childProcessOptions.detached = true;
    }
  }
  if (platform === "darwin" && appArguments.length > 0) {
    cliArguments.push("--args", ...appArguments);
  }
  if (options.target) {
    cliArguments.push(options.target);
  }
  const subprocess = import_node_child_process9.default.spawn(command, cliArguments, childProcessOptions);
  if (options.wait) {
    return new Promise((resolve, reject) => {
      subprocess.once("error", reject);
      subprocess.once("close", (exitCode) => {
        if (!options.allowNonzeroExitCode && exitCode !== 0) {
          reject(new Error(`Exited with code ${exitCode}`));
          return;
        }
        resolve(subprocess);
      });
    });
  }
  if (isFallbackAttempt) {
    return new Promise((resolve, reject) => {
      subprocess.once("error", reject);
      subprocess.once("spawn", () => {
        subprocess.once("close", (exitCode) => {
          subprocess.off("error", reject);
          if (exitCode !== 0) {
            reject(new Error(`Exited with code ${exitCode}`));
            return;
          }
          subprocess.unref();
          resolve(subprocess);
        });
      });
    });
  }
  subprocess.unref();
  return new Promise((resolve, reject) => {
    subprocess.once("error", reject);
    subprocess.once("spawn", () => {
      subprocess.off("error", reject);
      resolve(subprocess);
    });
  });
};
var open = (target, options) => {
  if (typeof target !== "string") {
    throw new TypeError("Expected a `target`");
  }
  return baseOpen({
    ...options,
    target
  });
};
function detectArchBinary(binary) {
  if (typeof binary === "string" || Array.isArray(binary)) {
    return binary;
  }
  const { [arch]: archBinary } = binary;
  if (!archBinary) {
    throw new Error(`${arch} is not supported`);
  }
  return archBinary;
}
function detectPlatformBinary({ [platform]: platformBinary }, { wsl } = {}) {
  if (wsl && is_wsl_default) {
    return detectArchBinary(wsl);
  }
  if (!platformBinary) {
    throw new Error(`${platform} is not supported`);
  }
  return detectArchBinary(platformBinary);
}
var apps = {
  browser: "browser",
  browserPrivate: "browserPrivate"
};
defineLazyProperty(apps, "chrome", () => detectPlatformBinary({
  darwin: "google chrome",
  win32: "chrome",
  // `chromium-browser` is the older deb package name used by Ubuntu/Debian before snap.
  linux: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]
}, {
  wsl: {
    ia32: "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    x64: ["/mnt/c/Program Files/Google/Chrome/Application/chrome.exe", "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
  }
}));
defineLazyProperty(apps, "brave", () => detectPlatformBinary({
  darwin: "brave browser",
  win32: "brave",
  linux: ["brave-browser", "brave"]
}, {
  wsl: {
    ia32: "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
    x64: ["/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"]
  }
}));
defineLazyProperty(apps, "firefox", () => detectPlatformBinary({
  darwin: "firefox",
  win32: String.raw`C:\Program Files\Mozilla Firefox\firefox.exe`,
  linux: "firefox"
}, {
  wsl: "/mnt/c/Program Files/Mozilla Firefox/firefox.exe"
}));
defineLazyProperty(apps, "edge", () => detectPlatformBinary({
  darwin: "microsoft edge",
  win32: "msedge",
  linux: ["microsoft-edge", "microsoft-edge-dev"]
}, {
  wsl: "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
}));
defineLazyProperty(apps, "safari", () => detectPlatformBinary({
  darwin: "Safari"
}));
var open_default = open;

// electron/integrations/gmail/index.ts
var import_server_destroy = __toESM(require_server_destroy());
var import_fs4 = __toESM(require("fs"));
var import_path4 = __toESM(require("path"));
var import_electron7 = require("electron");
var SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
var REDIRECT_URI = "http://127.0.0.1:3000/oauth2callback";
var TOKEN_FILE = "gmail-tokens.json";
var CREDENTIALS_FILE = import_path4.default.join(__dirname, "config", "gmail-credentials.json");
var oauth2Client = null;
function loadCredentials() {
  try {
    if (import_fs4.default.existsSync(CREDENTIALS_FILE)) {
      const data = import_fs4.default.readFileSync(CREDENTIALS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load Gmail credentials:", error);
  }
  return null;
}
function getTokenPath() {
  return import_path4.default.join(import_electron7.app.getPath("userData"), TOKEN_FILE);
}
function loadTokens() {
  try {
    const tokenPath = getTokenPath();
    if (import_fs4.default.existsSync(tokenPath)) {
      const data = import_fs4.default.readFileSync(tokenPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load Gmail tokens:", error);
  }
  return null;
}
function saveTokens(tokens) {
  try {
    const tokenPath = getTokenPath();
    import_fs4.default.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to save Gmail tokens:", error);
    return false;
  }
}
function clearTokens() {
  try {
    const tokenPath = getTokenPath();
    if (import_fs4.default.existsSync(tokenPath)) {
      import_fs4.default.unlinkSync(tokenPath);
    }
    oauth2Client = null;
    return true;
  } catch (error) {
    console.error("Failed to clear Gmail tokens:", error);
    return false;
  }
}
function getOAuth2Client() {
  if (oauth2Client) {
    return oauth2Client;
  }
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error("Gmail credentials not found. Please create config/gmail-credentials.json");
  }
  oauth2Client = new import_googleapis.google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    REDIRECT_URI
  );
  const tokens = loadTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }
  oauth2Client.on("tokens", (tokens2) => {
    console.log("Gmail tokens refreshed");
    const existingTokens = loadTokens() || {};
    const newTokens = { ...existingTokens, ...tokens2 };
    saveTokens(newTokens);
    oauth2Client.setCredentials(newTokens);
  });
  return oauth2Client;
}
function isAuthenticated() {
  try {
    const client = getOAuth2Client();
    const credentials = client.credentials;
    return !!(credentials && (credentials.access_token || credentials.refresh_token));
  } catch {
    return false;
  }
}
async function authenticate() {
  return new Promise((resolve, reject) => {
    const client = getOAuth2Client();
    const server = import_http2.default.createServer(async (req, res) => {
      try {
        if (req.url.startsWith("/oauth2callback")) {
          const qs = new import_url.URL(req.url, "http://127.0.0.1:3000").searchParams;
          const code = qs.get("code");
          const error = qs.get("error");
          if (error) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
                  <div style="text-align: center; color: #ff6b6b;">
                    <h1>Authentication Failed</h1>
                    <p>Error: ${error}</p>
                    <p>You can close this tab.</p>
                  </div>
                </body>
              </html>
            `);
            server.destroy();
            reject(new Error(`Authentication failed: ${error}`));
            return;
          }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
                <div style="text-align: center; color: #4ade80;">
                  <h1>Authentication Successful!</h1>
                  <p>You can close this tab and return to the app.</p>
                </div>
              </body>
            </html>
          `);
          server.destroy();
          const { tokens } = await client.getToken(code);
          client.setCredentials(tokens);
          saveTokens(tokens);
          resolve(tokens);
        }
      } catch (e) {
        reject(e);
      }
    }).listen(3e3, () => {
      const authUrl = client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent"
        // Force consent to get refresh token
      });
      open_default(authUrl);
    });
    (0, import_server_destroy.default)(server);
    setTimeout(() => {
      server.destroy();
      reject(new Error("Authentication timeout"));
    }, 5 * 60 * 1e3);
  });
}
function signOut() {
  return clearTokens();
}

// electron/integrations/gmail/gmailClient.ts
var import_googleapis2 = require("googleapis");
function getGmailClient() {
  if (!isAuthenticated()) {
    throw new Error("Not authenticated. Please sign in first.");
  }
  const auth = getOAuth2Client();
  return import_googleapis2.google.gmail({ version: "v1", auth });
}
async function getUserProfile() {
  const gmail = getGmailClient();
  const response = await gmail.users.getProfile({ userId: "me" });
  return response.data;
}
async function getRecentEmails(maxResults = 10) {
  const gmail = getGmailClient();
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    labelIds: ["INBOX"]
  });
  const messages = listResponse.data.messages || [];
  if (messages.length === 0) {
    return [];
  }
  const emailPromises = messages.map(async (message) => {
    const msgResponse = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"]
    });
    const msg = msgResponse.data;
    const headers = msg.payload?.headers || [];
    const getHeader = (name) => {
      const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || "";
    };
    let hasAttachments = false;
    let attachmentCount = 0;
    const countAttachments = (part) => {
      if (part.body?.attachmentId || part.filename && part.filename.length > 0) {
        attachmentCount++;
        hasAttachments = true;
      }
      if (part.parts) {
        part.parts.forEach(countAttachments);
      }
    };
    if (msg.payload) {
      countAttachments(msg.payload);
    }
    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || "",
      subject: getHeader("Subject"),
      from: getHeader("From"),
      date: getHeader("Date"),
      labelIds: msg.labelIds || [],
      isUnread: msg.labelIds?.includes("UNREAD") || false,
      hasAttachments,
      attachmentCount
    };
  });
  return Promise.all(emailPromises);
}
async function getEmailDetails(messageId) {
  const gmail = getGmailClient();
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  });
  const msg = response.data;
  const headers = msg.payload?.headers || [];
  const getHeader = (name) => {
    const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || "";
  };
  let body = "";
  const extractBody = (part) => {
    if (part.body?.data) {
      const decoded = Buffer.from(part.body.data, "base64url").toString("utf8");
      if (part.mimeType === "text/plain") {
        body = decoded;
      } else if (part.mimeType === "text/html" && !body) {
        body = decoded;
      }
    }
    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };
  if (msg.payload) {
    extractBody(msg.payload);
  }
  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: msg.snippet || "",
    subject: getHeader("Subject"),
    from: getHeader("From"),
    to: getHeader("To"),
    date: getHeader("Date"),
    body,
    labelIds: msg.labelIds || [],
    isUnread: msg.labelIds?.includes("UNREAD") || false
  };
}
async function searchEmails(query, maxResults = 10) {
  const gmail = getGmailClient();
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: query
  });
  const messages = listResponse.data.messages || [];
  if (messages.length === 0) {
    return [];
  }
  const emailPromises = messages.map(async (message) => {
    const msgResponse = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"]
    });
    const msg = msgResponse.data;
    const headers = msg.payload?.headers || [];
    const getHeader = (name) => {
      const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || "";
    };
    let hasAttachments = false;
    let attachmentCount = 0;
    const countAttachments = (part) => {
      if (part.body?.attachmentId || part.filename && part.filename.length > 0) {
        attachmentCount++;
        hasAttachments = true;
      }
      if (part.parts) {
        part.parts.forEach(countAttachments);
      }
    };
    if (msg.payload) {
      countAttachments(msg.payload);
    }
    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || "",
      subject: getHeader("Subject"),
      from: getHeader("From"),
      date: getHeader("Date"),
      labelIds: msg.labelIds || [],
      isUnread: msg.labelIds?.includes("UNREAD") || false,
      hasAttachments,
      attachmentCount
    };
  });
  return Promise.all(emailPromises);
}
async function markAsRead(messageId) {
  const gmail = getGmailClient();
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"]
    }
  });
  return true;
}
async function markAsUnread(messageId) {
  const gmail = getGmailClient();
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: ["UNREAD"]
    }
  });
  return true;
}

// electron/main.ts
var PROJECT_ROOT = import_path5.default.join(__dirname, "..");
var isDev = !import_electron8.app.isPackaged;
var sandboxState = {
  isFallback: process.env.MOSAIC_SANDBOX_FALLBACK === "1",
  isLinux: process.platform === "linux",
  isAppImage: !!process.env.APPIMAGE,
  noSandboxFlag: process.argv.includes("--no-sandbox")
};
if (sandboxState.isLinux && sandboxState.isAppImage) {
  console.log("\u{1F427} Linux AppImage detected");
  console.log(`   Sandbox fallback: ${sandboxState.isFallback}`);
  console.log(`   No-sandbox flag: ${sandboxState.noSandboxFlag}`);
}
var require2 = (0, import_module.createRequire)(__filename);
if (process.platform === "win32") {
  try {
    if (require2("electron-squirrel-startup")) {
      process.exit(0);
    }
  } catch (e) {
  }
}
var gotTheLock = import_electron8.app.requestSingleInstanceLock();
if (!gotTheLock) {
  import_electron8.app.quit();
}
var agentsHistoryPath2 = import_path5.default.join(import_electron8.app.getPath("userData"), "agents_history");
var mainWindow2 = null;
var mosaicBotStop = null;
function getIconPath() {
  const iconPath = import_path5.default.join(PROJECT_ROOT, "assets", "icon.png");
  if (import_fs5.default.existsSync(iconPath)) {
    return iconPath;
  }
  if (process.platform === "win32") {
    const icoPath = import_path5.default.join(PROJECT_ROOT, "assets", "icon.ico");
    if (import_fs5.default.existsSync(icoPath)) return icoPath;
  }
  console.warn("Icon not found at:", iconPath);
  return iconPath;
}
function createWindow2(urlToLoad = null) {
  const titleBarStyle = getTitleBarStyle();
  const useFrame = titleBarStyle === "default";
  const electronTitleBarStyle = titleBarStyle === "default" ? "default" : "hidden";
  const win = new import_electron8.BrowserWindow({
    width: 1280,
    height: 800,
    icon: getIconPath(),
    frame: useFrame,
    titleBarStyle: electronTitleBarStyle,
    trafficLightPosition: { x: 10, y: 10 },
    backgroundColor: "#111827",
    webPreferences: {
      // preload.js is in the same directory as main.js (dist_electron)
      preload: import_path5.default.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      backgroundThrottling: false
    }
  });
  if (urlToLoad) {
    win.loadURL(urlToLoad);
  } else if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log("Loading from Vite dev server:", process.env.VITE_DEV_SERVER_URL);
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    const indexPath = import_path5.default.join(PROJECT_ROOT, "dist", "index.html");
    console.log("Loading index from:", indexPath);
    console.log("File exists:", import_fs5.default.existsSync(indexPath));
    win.loadFile(indexPath);
  }
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorCode} (${errorDescription})`);
  });
  mainWindow2 = win;
  return win;
}
import_electron8.app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
  if (mainWindow2) {
    if (mainWindow2.isMinimized()) mainWindow2.restore();
    mainWindow2.focus();
  }
});
function recreateWindow() {
  if (!mainWindow2) return;
  const currentURL = mainWindow2.webContents.getURL();
  const bounds = mainWindow2.getBounds();
  mainWindow2.close();
  const newWin = createWindow2(currentURL);
  newWin.setBounds(bounds);
  console.log("Window recreated with new titleBarStyle");
}
import_electron8.app.on("before-quit", () => {
  mcpClient.disconnectAll();
  if (mosaicBotStop) mosaicBotStop().catch(console.error);
});
import_electron8.app.on("web-contents-created", (_event, contents) => {
  contents.on("did-fail-load", (event, errorCode) => {
    if (errorCode === -3) {
      event.preventDefault();
    }
  });
});
import_electron8.app.whenReady().then(() => {
  console.log("App is packaged:", import_electron8.app.isPackaged);
  console.log("User data path:", import_electron8.app.getPath("userData"));
  console.log("__dirname:", __dirname);
  console.log("PROJECT_ROOT:", PROJECT_ROOT);
  const agentsHistoryPathExist = getDirectoryStatus(agentsHistoryPath2);
  if (!agentsHistoryPathExist.exists) {
    try {
      import_fs5.default.mkdirSync(agentsHistoryPath2, { recursive: true });
    } catch (e) {
      console.log(`Error when creating agents path: ${e}`);
    }
  }
  createWindow2();
  initMosaicBot().then((bot) => {
    mosaicBotStop = bot.stop.bind(bot);
  }).catch((e) => {
    console.error("[MosaicBot] Init failed:", e);
  });
  if (import_electron8.app.isPackaged) {
    initUpdater();
    setTimeout(() => {
      console.log("Starting update check...");
      checkForUpdates();
    }, 2e3);
  }
  try {
    if (isAuthenticated()) {
      console.log("Gmail: Already authenticated, tokens loaded");
    }
  } catch (e) {
  }
});
import_electron8.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron8.app.quit();
  }
});
import_electron8.app.on("activate", () => {
  if (import_electron8.BrowserWindow.getAllWindows().length === 0) {
    createWindow2();
  }
});
import_electron8.ipcMain.handle("restart-window", async () => {
  recreateWindow();
  return { success: true };
});
import_electron8.ipcMain.handle("show-title-bar-confirm", async () => {
  const { dialog: dialog2 } = await import("electron");
  const result = await dialog2.showMessageBox(mainWindow2, {
    type: "question",
    title: "Apply Title Bar Style",
    message: "This will refresh the window to apply the new title bar style.",
    detail: "Any unsaved work could be lost.",
    buttons: ["Apply Now", "Apply Later", "Cancel"],
    defaultId: 0,
    cancelId: 2
  });
  return { buttonIndex: result.response };
});
import_electron8.ipcMain.handle("window:minimize", () => {
  if (mainWindow2) mainWindow2.minimize();
});
import_electron8.ipcMain.handle("window:maximize", () => {
  if (mainWindow2) {
    if (mainWindow2.isMaximized()) {
      mainWindow2.unmaximize();
    } else {
      mainWindow2.maximize();
    }
  }
});
import_electron8.ipcMain.handle("window:close", () => {
  if (mainWindow2) mainWindow2.close();
});
import_electron8.ipcMain.handle("window:is-maximized", () => {
  return mainWindow2 ? mainWindow2.isMaximized() : false;
});
var csvPath = import_path5.default.join(import_electron8.app.getPath("userData"), "input_history.csv");
if (!import_fs5.default.existsSync(csvPath)) {
  import_fs5.default.writeFileSync(csvPath, "timestamp,text\n", "utf8");
}
import_electron8.ipcMain.handle("log-input", async (_event, text) => {
  try {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const escapedText = `"${text.replace(/"/g, '""').replace(/\n/g, "\\n")}"`;
    const line = `${timestamp},${escapedText}
`;
    import_fs5.default.appendFileSync(csvPath, line, "utf8");
    return { success: true, path: csvPath };
  } catch (error) {
    console.log(error);
    return { success: false, path: csvPath };
  }
});
import_electron8.ipcMain.handle("get-csv-path", () => csvPath);
import_electron8.ipcMain.handle("check-for-updates", async () => {
  if (import_electron8.app.isPackaged) {
    manualCheckForUpdates();
    return { triggered: true };
  }
  const { dialog: dialog2 } = await import("electron");
  dialog2.showMessageBox({
    type: "info",
    title: "Development Mode",
    message: "Updates are disabled in development mode.",
    detail: "Build and run the packaged app to test updates."
  });
  return { triggered: false, reason: "Updates disabled in development mode" };
});
import_electron8.ipcMain.handle("get-update-settings", async () => {
  return getUpdateSettings();
});
import_electron8.ipcMain.handle(
  "set-update-settings",
  async (_event, newSettings) => {
    const result = setUpdateSettings(newSettings);
    if (result.success && result.settings) {
      applyAutoDownload(result.settings.autoDownload);
    }
    return result;
  }
);
import_electron8.ipcMain.handle("get-update-log-path", async () => {
  return getLogFilePath();
});
import_electron8.ipcMain.handle("get-update-logs", async () => {
  return readLogFile();
});
function broadcastNodesChanged(nodes) {
  import_electron8.BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("nodes-changed", nodes);
  });
}
import_electron8.ipcMain.handle("nodes:get", async () => {
  return getNodes();
});
import_electron8.ipcMain.handle("nodes:add", async (_event, node) => {
  const result = addNode(node);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});
import_electron8.ipcMain.handle("nodes:update", async (_event, id, updates) => {
  const result = updateNode(id, updates);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});
import_electron8.ipcMain.handle("nodes:delete", async (_event, id) => {
  const result = deleteNode(id);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});
import_electron8.ipcMain.handle("sandbox:get-state", async () => sandboxState);
var aiAgentsPath = import_path5.default.join(import_electron8.app.getPath("userData"), "ai-agents.json");
var themesPath = import_path5.default.join(import_electron8.app.getPath("userData"), "themes.json");
function readAgents() {
  try {
    if (import_fs5.default.existsSync(aiAgentsPath)) {
      const data = import_fs5.default.readFileSync(aiAgentsPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read AI agents:", error);
  }
  return [];
}
function writeAgents(agents) {
  try {
    import_fs5.default.writeFileSync(aiAgentsPath, JSON.stringify(agents, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write AI agents:", error);
    return false;
  }
}
function readThemeSettings() {
  try {
    if (import_fs5.default.existsSync(themesPath)) {
      const data = import_fs5.default.readFileSync(themesPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read theme settings:", error);
  }
  return { activeTheme: "dark" };
}
function writeThemeSettings(settings2) {
  try {
    import_fs5.default.writeFileSync(themesPath, JSON.stringify(settings2, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write theme settings:", error);
    return false;
  }
}
import_electron8.ipcMain.handle("ai-agents:get", async () => {
  return readAgents();
});
import_electron8.ipcMain.handle("ai-agents:set", async (_event, agents) => {
  try {
    writeAgents(agents);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron8.ipcMain.handle("ai-agents:add", async (_event, agent) => {
  try {
    const agents = readAgents();
    agents.push(agent);
    writeAgents(agents);
    const agentPath = import_path5.default.join(agentsHistoryPath2, agent.id.toString());
    import_fs5.default.mkdirSync(agentPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron8.ipcMain.handle("ai-agents:update", async (_event, id, updates) => {
  try {
    const agents = readAgents();
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) {
      return { success: false, error: "Agent not found" };
    }
    agents[index] = { ...agents[index], ...updates };
    writeAgents(agents);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron8.ipcMain.handle("ai-agents:delete", async (_event, id) => {
  try {
    const agents = readAgents();
    const filtered = agents.filter((a) => a.id !== id);
    writeAgents(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron8.ipcMain.handle("ai-agents:clear", async () => {
  try {
    writeAgents([]);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron8.ipcMain.handle("gmail:sign-in", async () => {
  try {
    await authenticate();
    const profile = await getUserProfile();
    return { success: true, email: profile.emailAddress };
  } catch (error) {
    console.error("Gmail sign-in error:", error);
    return { success: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:sign-out", async () => {
  try {
    signOut();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:get-status", async () => {
  try {
    const authenticated = isAuthenticated();
    if (authenticated) {
      const profile = await getUserProfile();
      return { authenticated: true, email: profile.emailAddress };
    }
    return { authenticated: false };
  } catch (error) {
    return { authenticated: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:get-emails", async (_event, count = 10) => {
  try {
    const emails = await getRecentEmails(count);
    return { success: true, emails };
  } catch (error) {
    console.error("Gmail fetch error:", error);
    return { success: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:get-email-details", async (_event, messageId) => {
  try {
    const email = await getEmailDetails(messageId);
    return { success: true, email };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:search-emails", async (_event, query, count = 10) => {
  try {
    const emails = await searchEmails(query, count);
    return { success: true, emails };
  } catch (error) {
    console.error("Gmail search error:", error);
    return { success: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:mark-read", async (_event, messageId) => {
  try {
    await markAsRead(messageId);
    return { success: true };
  } catch (error) {
    console.error("Gmail mark read error:", error);
    return { success: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:mark-unread", async (_event, messageId) => {
  try {
    await markAsUnread(messageId);
    return { success: true };
  } catch (error) {
    console.error("Gmail mark unread error:", error);
    return { success: false, error: error.message };
  }
});
import_electron8.ipcMain.handle("gmail:get-auto-mark-read", () => {
  return { enabled: getGmailAutoMarkRead() };
});
import_electron8.ipcMain.handle("gmail:set-auto-mark-read", (_event, enabled) => {
  const result = setGmailAutoMarkRead(enabled);
  return { ...result, enabled: getGmailAutoMarkRead() };
});
import_electron8.ipcMain.handle("themes:get", async () => {
  return readThemeSettings();
});
import_electron8.ipcMain.handle("themes:set", async (_event, activeTheme) => {
  const settings2 = { activeTheme };
  const success = writeThemeSettings(settings2);
  return { success };
});
import_electron8.ipcMain.handle("ai-agents-history:get-all", async (_event, agentId) => {
  return readAgentHistories(agentId);
});
import_electron8.ipcMain.handle("ai-agents-history:get", async (_event, agentId, sessionId) => {
  return readAgentHistory(agentId, sessionId);
});
import_electron8.ipcMain.handle("ai-agents-history:save", async (_event, chatSession) => {
  try {
    const success = writeAgentHistory(chatSession);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron8.ipcMain.handle("ai-agents-history:delete", async (_event, agentId, sessionId) => {
  try {
    const success = deleteAgentHistory(agentId, sessionId);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron8.ipcMain.handle("ai-agents-history:delete-all", async (_event, agentId) => {
  try {
    const success = deleteAllAgentHistories(agentId);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
