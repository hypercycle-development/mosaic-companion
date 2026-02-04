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
        const cached = cache.get(memoKey);
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
        cache.set(memoKey, result);
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
    var cache = new LRU();
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
var import_electron6 = require("electron");
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
var import_child_process = require("child_process");
var path4 = __toESM(require("path"));
var readline = __toESM(require("readline"));
var MCPClient = class {
  constructor() {
    this.connections = /* @__PURE__ */ new Map();
    this.mainWindow = null;
  }
  setMainWindow(window) {
    this.mainWindow = window;
  }
  // ============ STDIO TRANSPORT ============
  async connectStdio(config) {
    if (!config.command) {
      throw new Error("STDIO transport requires a command");
    }
    console.log(`[MCP] Connecting to ${config.name} via STDIO...`);
    const connection = {
      config,
      requestId: 0,
      pendingRequests: /* @__PURE__ */ new Map(),
      tools: [],
      resources: [],
      prompts: [],
      initialized: false
    };
    const childProcess4 = (0, import_child_process.spawn)(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"]
    });
    connection.process = childProcess4;
    const rl = readline.createInterface({
      input: childProcess4.stdout,
      crlfDelay: Infinity
    });
    rl.on("line", (line) => {
      try {
        const message = JSON.parse(line);
        this.handleMessage(config.name, message);
      } catch (error) {
        console.error(
          `[MCP] Failed to parse message from ${config.name}:`,
          error
        );
      }
    });
    childProcess4.stderr?.on("data", (data) => {
      console.log(`[MCP] ${config.name} stderr:`, data.toString());
    });
    childProcess4.on("exit", (code) => {
      console.log(`[MCP] ${config.name} exited with code ${code}`);
      this.connections.delete(config.name);
      this.notifyRenderer("mcp:server-disconnected", {
        name: config.name,
        code
      });
    });
    childProcess4.on("error", (error) => {
      console.error(`[MCP] ${config.name} error:`, error);
      this.notifyRenderer("mcp:server-error", {
        name: config.name,
        error: error.message
      });
    });
    this.connections.set(config.name, connection);
    await this.initializeConnection(config.name);
  }
  // ============ HTTP TRANSPORT ============
  async connectHttp(config) {
    if (!config.url) {
      throw new Error("HTTP transport requires a URL");
    }
    console.log(
      `[MCP] Connecting to ${config.name} via HTTP at ${config.url}...`
    );
    const connection = {
      config,
      requestId: 0,
      pendingRequests: /* @__PURE__ */ new Map(),
      tools: [],
      resources: [],
      prompts: [],
      initialized: false
    };
    this.connections.set(config.name, connection);
    await this.initializeConnection(config.name);
  }
  // ============ CONNECTION MANAGEMENT ============
  async initializeConnection(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    const initResult = await this.sendRequest(serverName, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: "electron-mcp-client",
        version: "1.0.0"
      }
    });
    console.log(`[MCP] ${serverName} initialized:`, initResult);
    await this.sendNotification(serverName, "notifications/initialized", {});
    connection.initialized = true;
    await this.refreshCapabilities(serverName);
    this.notifyRenderer("mcp:server-connected", {
      name: serverName,
      tools: connection.tools,
      resources: connection.resources,
      prompts: connection.prompts
    });
  }
  async refreshCapabilities(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    try {
      const toolsResult = await this.sendRequest(
        serverName,
        "tools/list",
        {}
      );
      connection.tools = toolsResult.tools || [];
      console.log(
        `[MCP] ${serverName} tools:`,
        connection.tools.map((t) => t.name)
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support tools`);
    }
    try {
      const resourcesResult = await this.sendRequest(
        serverName,
        "resources/list",
        {}
      );
      connection.resources = resourcesResult.resources || [];
      console.log(
        `[MCP] ${serverName} resources:`,
        connection.resources.map((r) => r.uri)
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support resources`);
    }
    try {
      const promptsResult = await this.sendRequest(
        serverName,
        "prompts/list",
        {}
      );
      connection.prompts = promptsResult.prompts || [];
      console.log(
        `[MCP] ${serverName} prompts:`,
        connection.prompts.map((p) => p.name)
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support prompts`);
    }
  }
  async disconnect(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) return;
    if (connection.process) {
      connection.process.kill();
    }
    this.connections.delete(serverName);
    console.log(`[MCP] Disconnected from ${serverName}`);
  }
  async disconnectAll() {
    for (const name of this.connections.keys()) {
      await this.disconnect(name);
    }
  }
  // ============ MESSAGE HANDLING ============
  async sendRequest(serverName, method, params) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    const id = ++connection.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };
    return new Promise((resolve, reject) => {
      connection.pendingRequests.set(id, { resolve, reject });
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 3e4);
      if (connection.config.transport === "stdio" && connection.process) {
        connection.process.stdin?.write(JSON.stringify(request) + "\n");
      } else if (connection.config.transport === "http") {
        this.sendHttpRequest(connection, request).then(resolve).catch(reject).finally(() => {
          clearTimeout(timeout);
          connection.pendingRequests.delete(id);
        });
        return;
      }
      const originalResolve = connection.pendingRequests.get(id).resolve;
      connection.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }
  async sendHttpRequest(connection, request) {
    const headers = {
      "Content-Type": "application/json"
    };
    if (connection.config.apiKey) {
      headers["Authorization"] = `Bearer ${connection.config.apiKey}`;
    }
    const response = await fetch(connection.config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (result.error) {
      throw new Error(`MCP Error: ${result.error.message}`);
    }
    return result.result;
  }
  async sendNotification(serverName, method, params) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };
    if (connection.config.transport === "stdio" && connection.process) {
      connection.process.stdin?.write(JSON.stringify(notification) + "\n");
    } else if (connection.config.transport === "http") {
      fetch(connection.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...connection.config.apiKey && {
            Authorization: `Bearer ${connection.config.apiKey}`
          }
        },
        body: JSON.stringify(notification)
      }).catch(console.error);
    }
  }
  handleMessage(serverName, message) {
    const connection = this.connections.get(serverName);
    if (!connection) return;
    if ("id" in message && message.id !== null) {
      const pending = connection.pendingRequests.get(message.id);
      if (pending) {
        connection.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(
            new Error(message.error.message)
          );
        } else {
          pending.resolve(message.result);
        }
      }
    } else {
      this.handleNotification(serverName, message);
    }
  }
  handleNotification(serverName, notification) {
    console.log(`[MCP] ${serverName} notification:`, notification.method);
    switch (notification.method) {
      case "notifications/tools/list_changed":
        this.refreshCapabilities(serverName);
        break;
      case "notifications/resources/list_changed":
        this.refreshCapabilities(serverName);
        break;
      case "notifications/prompts/list_changed":
        this.refreshCapabilities(serverName);
        break;
      default:
        this.notifyRenderer("mcp:notification", {
          server: serverName,
          method: notification.method,
          params: notification.params
        });
    }
  }
  notifyRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
  // ============ PUBLIC API (exposed via IPC) ============
  async callTool(serverName, toolName, args) {
    console.log(`[MCP] Calling tool ${toolName} on ${serverName}`);
    return this.sendRequest(serverName, "tools/call", {
      name: toolName,
      arguments: args
    });
  }
  async readResource(serverName, uri) {
    console.log(`[MCP] Reading resource ${uri} from ${serverName}`);
    return this.sendRequest(serverName, "resources/read", { uri });
  }
  async getPrompt(serverName, promptName, args) {
    console.log(`[MCP] Getting prompt ${promptName} from ${serverName}`);
    return this.sendRequest(serverName, "prompts/get", {
      name: promptName,
      arguments: args
    });
  }
  getServers() {
    return Array.from(this.connections.entries()).map(([name, conn]) => ({
      name,
      transport: conn.config.transport,
      initialized: conn.initialized,
      tools: conn.tools,
      resources: conn.resources,
      prompts: conn.prompts
    }));
  }
};
var mcpClient = new MCPClient();
var mainWindow = null;
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
  mcpClient.setMainWindow(mainWindow);
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
import_electron4.ipcMain.handle("mcp:connect", async (_event, config) => {
  try {
    if (config.transport === "stdio") {
      await mcpClient.connectStdio(config);
    } else {
      await mcpClient.connectHttp(config);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron4.ipcMain.handle("mcp:disconnect", async (_event, serverName) => {
  await mcpClient.disconnect(serverName);
  return { success: true };
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

// electron/main.ts
var import_module = require("module");

// electron/integrations/gmail/index.ts
var import_googleapis = require("googleapis");
var import_http = __toESM(require("http"));
var import_url = require("url");

// node_modules/open/index.js
var import_node_process7 = __toESM(require("node:process"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_url = require("node:url");
var import_node_child_process7 = __toESM(require("node:child_process"), 1);
var import_promises2 = __toESM(require("node:fs/promises"), 1);

// node_modules/wsl-utils/index.js
var import_node_util2 = require("node:util");
var import_node_child_process2 = __toESM(require("node:child_process"), 1);
var import_promises = __toESM(require("node:fs/promises"), 1);

// node_modules/is-wsl/index.js
var import_node_process = __toESM(require("node:process"), 1);
var import_node_os = __toESM(require("node:os"), 1);
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
  if (import_node_os.default.release().toLowerCase().includes("microsoft")) {
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
var import_node_util = require("node:util");
var import_node_child_process = __toESM(require("node:child_process"), 1);
var execFile = (0, import_node_util.promisify)(import_node_child_process.default.execFile);
var powerShellPath = () => `${import_node_process2.default.env.SYSTEMROOT || import_node_process2.default.env.windir || String.raw`C:\Windows`}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
var executePowerShell = async (command, options = {}) => {
  const {
    powerShellPath: psPath,
    ...execFileOptions
  } = options;
  const encodedCommand = executePowerShell.encodeCommand(command);
  return execFile(
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
var execFile2 = (0, import_node_util2.promisify)(import_node_child_process2.default.execFile);
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
      await import_promises.default.access(configFilePath, import_promises.constants.F_OK);
      isConfigFileExists = true;
    } catch {
    }
    if (!isConfigFileExists) {
      return defaultMountPoint;
    }
    const configContent = await import_promises.default.readFile(configFilePath, { encoding: "utf8" });
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
      await import_promises.default.access(psPath, import_promises.constants.X_OK);
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
var convertWslPathToWindows = async (path8) => {
  if (/^[a-z]+:\/\//i.test(path8)) {
    return path8;
  }
  try {
    const { stdout } = await execFile2("wslpath", ["-aw", path8], { encoding: "utf8" });
    return stdout.trim();
  } catch {
    return path8;
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
var import_node_util6 = require("node:util");
var import_node_process5 = __toESM(require("node:process"), 1);
var import_node_child_process6 = require("node:child_process");

// node_modules/default-browser-id/index.js
var import_node_util3 = require("node:util");
var import_node_process3 = __toESM(require("node:process"), 1);
var import_node_child_process3 = require("node:child_process");
var execFileAsync = (0, import_node_util3.promisify)(import_node_child_process3.execFile);
async function defaultBrowserId() {
  if (import_node_process3.default.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const { stdout } = await execFileAsync("defaults", ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"]);
  const match = /LSHandlerRoleAll = "(?!-)(?<id>[^"]+?)";\s+?LSHandlerURLScheme = (?:http|https);/.exec(stdout);
  const browserId = match?.groups.id ?? "com.apple.Safari";
  if (browserId === "com.apple.safari") {
    return "com.apple.Safari";
  }
  return browserId;
}

// node_modules/run-applescript/index.js
var import_node_process4 = __toESM(require("node:process"), 1);
var import_node_util4 = require("node:util");
var import_node_child_process4 = require("node:child_process");
var execFileAsync2 = (0, import_node_util4.promisify)(import_node_child_process4.execFile);
async function runAppleScript(script, { humanReadableOutput = true, signal } = {}) {
  if (import_node_process4.default.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const outputArguments = humanReadableOutput ? [] : ["-ss"];
  const execOptions = {};
  if (signal) {
    execOptions.signal = signal;
  }
  const { stdout } = await execFileAsync2("osascript", ["-e", script, outputArguments], execOptions);
  return stdout.trim();
}

// node_modules/bundle-name/index.js
async function bundleName(bundleId) {
  return runAppleScript(`tell application "Finder" to set app_path to application file id "${bundleId}" as string
tell application "System Events" to get value of property list item "CFBundleName" of property list file (app_path & ":Contents:Info.plist")`);
}

// node_modules/default-browser/windows.js
var import_node_util5 = require("node:util");
var import_node_child_process5 = require("node:child_process");
var execFileAsync3 = (0, import_node_util5.promisify)(import_node_child_process5.execFile);
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
async function defaultBrowser(_execFileAsync = execFileAsync3) {
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
var execFileAsync4 = (0, import_node_util6.promisify)(import_node_child_process6.execFile);
var titleize = (string) => string.toLowerCase().replaceAll(/(?:^|\s|-)\S/g, (x) => x.toUpperCase());
async function defaultBrowser2() {
  if (import_node_process5.default.platform === "darwin") {
    const id = await defaultBrowserId();
    const name = await bundleName(id);
    return { name, id };
  }
  if (import_node_process5.default.platform === "linux") {
    const { stdout } = await execFileAsync4("xdg-mime", ["query", "default", "x-scheme-handler/http"]);
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
var __dirname2 = import_meta.url ? import_node_path.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url)) : "";
var localXdgOpenPath = import_node_path.default.join(__dirname2, "xdg-open");
var { platform, arch } = import_node_process7.default;
var tryEachApp = async (apps2, opener) => {
  if (apps2.length === 0) {
    return;
  }
  const errors = [];
  for (const app7 of apps2) {
    try {
      return await opener(app7);
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
  let { name: app7, arguments: appArguments = [] } = options.app ?? {};
  appArguments = [...appArguments];
  if (Array.isArray(app7)) {
    return tryEachApp(app7, (appName) => baseOpen({
      ...options,
      app: {
        name: appName,
        arguments: appArguments
      },
      [fallbackAttemptSymbol]: true
    }));
  }
  if (app7 === "browser" || app7 === "browserPrivate") {
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
      if (app7 === "browserPrivate") {
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
  if (is_wsl_default && !isInsideContainer() && !is_in_ssh_default && !app7) {
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
    if (app7) {
      cliArguments.push("-a", app7);
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
    if (app7) {
      encodedArguments.push(executePowerShell.escapeArgument(app7));
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
    if (app7) {
      command = app7;
    } else {
      const isBundled = !__dirname2 || __dirname2 === "/";
      let exeLocalXdgOpen = false;
      try {
        await import_promises2.default.access(localXdgOpenPath, import_promises2.constants.X_OK);
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
  const subprocess = import_node_child_process7.default.spawn(command, cliArguments, childProcessOptions);
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
var import_electron5 = require("electron");
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
  return import_path4.default.join(import_electron5.app.getPath("userData"), TOKEN_FILE);
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
    const server = import_http.default.createServer(async (req, res) => {
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
var isDev = !import_electron6.app.isPackaged;
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
var gotTheLock = import_electron6.app.requestSingleInstanceLock();
if (!gotTheLock) {
  import_electron6.app.quit();
}
var agentsHistoryPath2 = import_path5.default.join(import_electron6.app.getPath("userData"), "agents_history");
var mainWindow2 = null;
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
  const win = new import_electron6.BrowserWindow({
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
import_electron6.app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
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
import_electron6.app.on("before-quit", () => {
  mcpClient.disconnectAll();
});
import_electron6.app.on("web-contents-created", (_event, contents) => {
  contents.on("did-fail-load", (event, errorCode) => {
    if (errorCode === -3) {
      event.preventDefault();
    }
  });
});
import_electron6.app.whenReady().then(() => {
  console.log("App is packaged:", import_electron6.app.isPackaged);
  console.log("User data path:", import_electron6.app.getPath("userData"));
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
  if (import_electron6.app.isPackaged) {
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
import_electron6.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron6.app.quit();
  }
});
import_electron6.app.on("activate", () => {
  if (import_electron6.BrowserWindow.getAllWindows().length === 0) {
    createWindow2();
  }
});
import_electron6.ipcMain.handle("restart-window", async () => {
  recreateWindow();
  return { success: true };
});
import_electron6.ipcMain.handle("show-title-bar-confirm", async () => {
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
import_electron6.ipcMain.handle("window:minimize", () => {
  if (mainWindow2) mainWindow2.minimize();
});
import_electron6.ipcMain.handle("window:maximize", () => {
  if (mainWindow2) {
    if (mainWindow2.isMaximized()) {
      mainWindow2.unmaximize();
    } else {
      mainWindow2.maximize();
    }
  }
});
import_electron6.ipcMain.handle("window:close", () => {
  if (mainWindow2) mainWindow2.close();
});
import_electron6.ipcMain.handle("window:is-maximized", () => {
  return mainWindow2 ? mainWindow2.isMaximized() : false;
});
var csvPath = import_path5.default.join(import_electron6.app.getPath("userData"), "input_history.csv");
if (!import_fs5.default.existsSync(csvPath)) {
  import_fs5.default.writeFileSync(csvPath, "timestamp,text\n", "utf8");
}
import_electron6.ipcMain.handle("log-input", async (_event, text) => {
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
import_electron6.ipcMain.handle("get-csv-path", () => csvPath);
import_electron6.ipcMain.handle("check-for-updates", async () => {
  if (import_electron6.app.isPackaged) {
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
import_electron6.ipcMain.handle("get-update-settings", async () => {
  return getUpdateSettings();
});
import_electron6.ipcMain.handle(
  "set-update-settings",
  async (_event, newSettings) => {
    const result = setUpdateSettings(newSettings);
    if (result.success && result.settings) {
      applyAutoDownload(result.settings.autoDownload);
    }
    return result;
  }
);
import_electron6.ipcMain.handle("get-update-log-path", async () => {
  return getLogFilePath();
});
import_electron6.ipcMain.handle("get-update-logs", async () => {
  return readLogFile();
});
function broadcastNodesChanged(nodes) {
  import_electron6.BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("nodes-changed", nodes);
  });
}
import_electron6.ipcMain.handle("nodes:get", async () => {
  return getNodes();
});
import_electron6.ipcMain.handle("nodes:add", async (_event, node) => {
  const result = addNode(node);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});
import_electron6.ipcMain.handle("nodes:update", async (_event, id, updates) => {
  const result = updateNode(id, updates);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});
import_electron6.ipcMain.handle("nodes:delete", async (_event, id) => {
  const result = deleteNode(id);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});
import_electron6.ipcMain.handle("sandbox:get-state", async () => sandboxState);
var aiAgentsPath = import_path5.default.join(import_electron6.app.getPath("userData"), "ai-agents.json");
var themesPath = import_path5.default.join(import_electron6.app.getPath("userData"), "themes.json");
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
import_electron6.ipcMain.handle("ai-agents:get", async () => {
  return readAgents();
});
import_electron6.ipcMain.handle("ai-agents:set", async (_event, agents) => {
  try {
    writeAgents(agents);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron6.ipcMain.handle("ai-agents:add", async (_event, agent) => {
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
import_electron6.ipcMain.handle("ai-agents:update", async (_event, id, updates) => {
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
import_electron6.ipcMain.handle("ai-agents:delete", async (_event, id) => {
  try {
    const agents = readAgents();
    const filtered = agents.filter((a) => a.id !== id);
    writeAgents(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron6.ipcMain.handle("ai-agents:clear", async () => {
  try {
    writeAgents([]);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron6.ipcMain.handle("gmail:sign-in", async () => {
  try {
    await authenticate();
    const profile = await getUserProfile();
    return { success: true, email: profile.emailAddress };
  } catch (error) {
    console.error("Gmail sign-in error:", error);
    return { success: false, error: error.message };
  }
});
import_electron6.ipcMain.handle("gmail:sign-out", async () => {
  try {
    signOut();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron6.ipcMain.handle("gmail:get-status", async () => {
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
import_electron6.ipcMain.handle("gmail:get-emails", async (_event, count = 10) => {
  try {
    const emails = await getRecentEmails(count);
    return { success: true, emails };
  } catch (error) {
    console.error("Gmail fetch error:", error);
    return { success: false, error: error.message };
  }
});
import_electron6.ipcMain.handle("gmail:get-email-details", async (_event, messageId) => {
  try {
    const email = await getEmailDetails(messageId);
    return { success: true, email };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import_electron6.ipcMain.handle("gmail:search-emails", async (_event, query, count = 10) => {
  try {
    const emails = await searchEmails(query, count);
    return { success: true, emails };
  } catch (error) {
    console.error("Gmail search error:", error);
    return { success: false, error: error.message };
  }
});
import_electron6.ipcMain.handle("gmail:mark-read", async (_event, messageId) => {
  try {
    await markAsRead(messageId);
    return { success: true };
  } catch (error) {
    console.error("Gmail mark read error:", error);
    return { success: false, error: error.message };
  }
});
import_electron6.ipcMain.handle("gmail:mark-unread", async (_event, messageId) => {
  try {
    await markAsUnread(messageId);
    return { success: true };
  } catch (error) {
    console.error("Gmail mark unread error:", error);
    return { success: false, error: error.message };
  }
});
import_electron6.ipcMain.handle("gmail:get-auto-mark-read", () => {
  return { enabled: getGmailAutoMarkRead() };
});
import_electron6.ipcMain.handle("gmail:set-auto-mark-read", (_event, enabled) => {
  const result = setGmailAutoMarkRead(enabled);
  return { ...result, enabled: getGmailAutoMarkRead() };
});
import_electron6.ipcMain.handle("themes:get", async () => {
  return readThemeSettings();
});
import_electron6.ipcMain.handle("themes:set", async (_event, activeTheme) => {
  const settings2 = { activeTheme };
  const success = writeThemeSettings(settings2);
  return { success };
});
import_electron6.ipcMain.handle("ai-agents-history:get-all", async (_event, agentId) => {
  return readAgentHistories(agentId);
});
import_electron6.ipcMain.handle("ai-agents-history:get", async (_event, agentId, sessionId) => {
  return readAgentHistory(agentId, sessionId);
});
import_electron6.ipcMain.handle("ai-agents-history:save", async (_event, chatSession) => {
  try {
    const success = writeAgentHistory(chatSession);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron6.ipcMain.handle("ai-agents-history:delete", async (_event, agentId, sessionId) => {
  try {
    const success = deleteAgentHistory(agentId, sessionId);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
import_electron6.ipcMain.handle("ai-agents-history:delete-all", async (_event, agentId) => {
  try {
    const success = deleteAllAgentHistories(agentId);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
