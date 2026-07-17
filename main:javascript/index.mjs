// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/main:javascript/index.mjs

/**
 * JavaScript Codec — минификация и обратное форматирование
 * Поддерживает: ES6+, модули, стрелочные функции, шаблонные строки
 */

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  minify: {
    removeComments: true,
    removeWhitespace: true,
    removeSemicolons: true,
    shortenVariables: true,
    shortenFunctions: true,
    compressNumbers: true,
    compressBooleans: true,
    removeUnused: true,
    removeConsole: false,
  },
  format: {
    indentSize: 4,
    maxLineLength: 120,
    useTabs: false,
    trailingComma: false,
    singleQuote: false,
    bracketSpacing: true,
    arrowParens: 'avoid',
  },
};

// ============================================================
// 2. КЛАСС JAVASCRIPT CODEC
// ============================================================

export class JavaScriptCodec {
  constructor(options = {}) {
    this.options = {
      minify: { ...CONFIG.minify, ...options.minify },
      format: { ...CONFIG.format, ...options.format },
    };
    this._variableMap = new Map();
    this._usedNames = new Set();
    this._counter = 0;
  }

  // ============================================================
  // 3. МИНИФИКАЦИЯ
  // ============================================================

  minify(code) {
    if (!code || typeof code !== 'string') return code;

    let result = code;

    if (this.options.minify.removeComments) {
      result = this._removeComments(result);
    }

    if (this.options.minify.removeWhitespace) {
      result = this._removeWhitespace(result);
    }

    if (this.options.minify.shortenVariables) {
      result = this._shortenVariables(result);
    }

    if (this.options.minify.shortenFunctions) {
      result = this._shortenFunctions(result);
    }

    if (this.options.minify.compressNumbers) {
      result = this._compressNumbers(result);
    }

    if (this.options.minify.compressBooleans) {
      result = this._compressBooleans(result);
    }

    if (this.options.minify.removeSemicolons) {
      result = this._removeSemicolons(result);
    }

    if (this.options.minify.removeUnused) {
      result = this._removeUnused(result);
    }

    result = result.trim();
    return result;
  }

  // ============================================================
  // 4. ФОРМАТИРОВАНИЕ (PRETTY-PRINT)
  // ============================================================

  format(code) {
    if (!code || typeof code !== 'string') return code;

    let result = code;

    result = this._restoreWhitespace(result);
    result = this._restoreNewlines(result);
    result = this._restoreIndentation(result);
    result = this._restoreSemicolons(result);
    result = this._formatObjects(result);
    result = this._formatFunctions(result);
    result = this._formatStrings(result);

    result = result.trim();
    return result;
  }

  // ============================================================
  // 5. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  _removeComments(code) {
    let result = code.replace(/\/\/[^\n]*/g, (match, offset) => {
      const before = code.substring(0, offset);
      const quotes = (before.match(/"/g) || []).length;
      const singleQuotes = (before.match(/'/g) || []).length;
      if (quotes % 2 === 1 || singleQuotes % 2 === 1) return match;
      return '';
    });
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
  }

  _removeWhitespace(code) {
    let result = code;
    result = result.replace(/[ \t]{2,}/g, ' ');
    result = result.replace(/\s*([=+\-*/%&|^<>!?:;,.])\s*/g, '$1');
    result = result.replace(/\s*([\[({])\s*/g, '$1');
    result = result.replace(/\s*([\]})])\s*/g, '$1');
    result = result.replace(/[ \t]+$/gm, '');
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.replace(/\s+,/g, ',');
    result = result.replace(/\(\s+/g, '(');
    result = result.replace(/\[\s+/g, '[');
    result = result.replace(/\{\s+/g, '{');
    result = result.replace(/\s+\)/g, ')');
    result = result.replace(/\s+\]/g, ']');
    result = result.replace(/\s+\}/g, '}');
    result = result.replace(/^\s*[\r\n]/gm, '');
    return result;
  }

  _shortenVariables(code) {
    const varPattern = /(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const matches = [...code.matchAll(varPattern)];
    const variables = matches.map(m => m[1]);

    const replacements = new Map();
    const usedNames = new Set();
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (const v of variables) {
      if (v.length <= 2) continue;
      if (['i', 'j', 'k', 'x', 'y', 'z', 'a', 'b', 'c'].includes(v)) continue;

      let newName = '';
      let pos = 0;
      do {
        newName = chars[pos % chars.length];
        pos++;
      } while (usedNames.has(newName) || code.includes(newName + '='));

      usedNames.add(newName);
      replacements.set(v, newName);
    }

    let result = code;
    for (const [oldName, newName] of replacements) {
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      result = result.replace(regex, newName);
    }

    return result;
  }

  _shortenFunctions(code) {
    let result = code;

    result = result.replace(
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g,
      (match, name, params) => {
        if (name.length <= 2) return match;
        if (['if', 'for', 'while', 'switch', 'try', 'catch'].includes(name)) return match;
        return `${name}=(${params})=>{`;
      }
    );

    result = result.replace(/function\s*\(([^)]*)\)\s*\{/g, (match, params) => {
      if (params.trim() === '') return '()=>{';
      return `(${params})=>{`;
    });

    result = result.replace(
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*function\s*\(([^)]*)\)\s*\{/g,
      (match, name, params) => {
        if (name === 'constructor') return match;
        return `${name}:(${params})=>{`;
      }
    );

    return result;
  }

  _compressNumbers(code) {
    let result = code;

    result = result.replace(/\b(\d{4,})\b/g, (match, num) => {
      const n = parseInt(num);
      if (n >= 1000 && n <= 9999) {
        return `${Math.round(n / 1000)}e3`;
      }
      if (n >= 10000 && n <= 99999) {
        const first = Math.floor(n / 1000);
        const rest = n % 1000;
        if (rest === 0) return `${first}e3`;
        return `${first}.${Math.round(rest / 100)}e3`;
      }
      return match;
    });

    result = result.replace(/\.(\d+)/g, (match, digits) => {
      if (match.startsWith('.')) {
        return `0.${digits}`;
      }
      return match;
    });

    return result;
  }

  _compressBooleans(code) {
    let result = code;
    result = result.replace(/\btrue\b/g, '!0');
    result = result.replace(/\bfalse\b/g, '!1');
    result = result.replace(/\bundefined\b/g, 'void 0');
    return result;
  }

  _removeSemicolons(code) {
    let result = code;
    result = result.replace(/;\s*$/gm, '');
    result = result.replace(/;;/g, ';');
    result = result.replace(/;\s*}/g, '}');
    result = result.replace(/{\s*;/g, '{');
    result = result.replace(/\(\s*;/g, '(');
    result = result.replace(/\[\s*;/g, '[');
    return result;
  }

  _removeUnused(code) {
    let result = code;
    result = result.replace(/;\s*;/g, ';');
    result = result.replace(/\bdebugger\b/g, '');
    if (this.options.minify.removeConsole) {
      result = result.replace(/console\.log\s*\([^)]*\)\s*;?/g, '');
      result = result.replace(/console\.debug\s*\([^)]*\)\s*;?/g, '');
      result = result.replace(/console\.info\s*\([^)]*\)\s*;?/g, '');
    }
    return result;
  }

  // ============================================================
  // 6. ФОРМАТИРОВАНИЕ (ВОССТАНОВЛЕНИЕ)
  // ============================================================

  _restoreWhitespace(code) {
    let result = code;
    result = result.replace(/([=+\-*/%&|^<>!?:;,.])([^=+\-*/%&|^<>!?:;,])/g, '$1 $2');
    result = result.replace(/([^=+\-*/%&|^<>!?:;,]) ([=+\-*/%&|^<>!?:;,.])([^=])/g, '$1 $2 $3');
    result = result.replace(/\(([^)]+)\)/g, (match, content) => {
      if (content.includes(',') || content.includes('=')) {
        return `(${content.trim()})`;
      }
      return match;
    });
    result = result.replace(/,([^ ])/g, ', $1');
    return result;
  }

  _restoreNewlines(code) {
    let result = code;
    const keywords = [
      'if',
      'else',
      'for',
      'while',
      'do',
      'switch',
      'case',
      'try',
      'catch',
      'finally',
      'function',
      'return',
      'throw',
      'class',
      'export',
      'import',
      'const',
      'let',
      'var',
    ];

    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'g');
      result = result.replace(regex, (match, offset) => {
        const before = result.substring(0, offset);
        const lastNewline = before.lastIndexOf('\n');
        if (lastNewline === -1 || offset - lastNewline < 20) {
          return '\n' + match;
        }
        return match;
      });
    }

    result = result.replace(/\}/g, '}\n');
    result = result.replace(/;/g, ';\n');
    result = result.replace(/\{/g, '{\n');
    result = result.replace(/\n{3,}/g, '\n\n');
    return result;
  }

  _restoreIndentation(code) {
    const lines = code.split('\n');
    let indentLevel = 0;
    const indent = this.options.format.useTabs ? '\t' : ' '.repeat(this.options.format.indentSize);
    const result = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        result.push('');
        continue;
      }

      if (trimmed.startsWith('}') || trimmed.startsWith(')') || trimmed.startsWith(']')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indentation = indent.repeat(indentLevel);
      result.push(indentation + trimmed);

      if (trimmed.endsWith('{') || trimmed.endsWith('(') || trimmed.endsWith('[')) {
        indentLevel++;
      }

      if (trimmed.includes('{') && trimmed.includes('}') && !trimmed.includes('\n')) {
        // Не увеличиваем отступ
      }
    }

    return result.join('\n');
  }

  _restoreSemicolons(code) {
    let result = code;
    const lines = result.split('\n');
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      if (
        !trimmed ||
        trimmed.endsWith('{') ||
        trimmed.endsWith('}') ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*')
      ) {
        newLines.push(line);
        continue;
      }

      const needSemicolon =
        !trimmed.endsWith(';') &&
        !trimmed.endsWith(':') &&
        !trimmed.endsWith(',') &&
        !trimmed.startsWith('function') &&
        !trimmed.startsWith('class') &&
        !trimmed.startsWith('if') &&
        !trimmed.startsWith('for') &&
        !trimmed.startsWith('while') &&
        !trimmed.startsWith('switch') &&
        !trimmed.startsWith('try') &&
        !trimmed.startsWith('catch') &&
        !trimmed.startsWith('with') &&
        !trimmed.startsWith('export') &&
        !trimmed.startsWith('import');

      if (needSemicolon) {
        line += ';';
      }

      newLines.push(line);
    }

    return newLines.join('\n');
  }

  _formatObjects(code) {
    let result = code;

    result = result.replace(/\{([^}]*)\}/g, (match, content) => {
      if (content.includes(',') && content.length > 40) {
        const items = content.split(',').map(item => item.trim());
        const formatted = items.map(item => {
          const parts = item.split(':').map(s => s.trim());
          if (parts.length === 2 && parts[1] && parts[1].includes(' ')) {
            return `${parts[0]}: ${parts[1]}`;
          }
          return item;
        });
        return '{\n' + formatted.map(item => '  ' + item).join(',\n') + '\n}';
      }
      return match;
    });

    result = result.replace(/\[([^\]]*)\]/g, (match, content) => {
      if (content.includes(',') && content.length > 40) {
        const items = content.split(',').map(item => item.trim());
        return '[\n' + items.map(item => '  ' + item).join(',\n') + '\n]';
      }
      return match;
    });

    return result;
  }

  _formatFunctions(code) {
    let result = code;

    result = result.replace(/\(([^)]*)\)\s*=>\s*\{([^}]*)\}/g, (match, params, body) => {
      const formattedBody = body.trim().replace(/;/g, ';\n  ');
      return `(${params}) => {\n  ${formattedBody}\n}`;
    });

    result = result.replace(
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{([^}]*)\}/g,
      (match, name, params, body) => {
        const formattedBody = body.trim().replace(/;/g, ';\n  ');
        return `function ${name}(${params}) {\n  ${formattedBody}\n}`;
      }
    );

    return result;
  }

  _formatStrings(code) {
    let result = code;

    if (this.options.format.singleQuote) {
      result = result.replace(/"/g, "'");
    }

    result = result.replace(/`([^`]*)`/g, (match, content) => {
      if (content.includes('${')) {
        return match;
      }
      return `'${content}'`;
    });

    return result;
  }

  // ============================================================
  // 7. ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  minifyAndFormat(code) {
    const minified = this.minify(code);
    return {
      original: code,
      minified: minified,
      formatted: this.format(minified),
      stats: this.getStats(code, minified),
    };
  }

  getStats(original, minified) {
    const originalSize = new Blob([original]).size;
    const minifiedSize = new Blob([minified]).size;
    const compression = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    return {
      originalSize: originalSize,
      minifiedSize: minifiedSize,
      compression: compression + '%',
      originalLines: original.split('\n').length,
      minifiedLines: minified.split('\n').length,
    };
  }

  validate(code) {
    try {
      new Function(code);
      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

// ============================================================
// 8. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default JavaScriptCodec;

// ============================================================
// 9. БРАУЗЕРНАЯ ВЕРСИЯ
// ============================================================

if (typeof window !== 'undefined') {
  window.JavaScriptCodec = JavaScriptCodec;
  window.codec = new JavaScriptCodec();

  console.log('📦 JavaScriptCodec загружен');
  console.log('📋 Доступные команды:');
  console.log('  codec.minify(code)          - минифицировать код');
  console.log('  codec.format(code)          - отформатировать код');
  console.log('  codec.minifyAndFormat(code) - минифицировать и отформатировать');
  console.log('  codec.validate(code)        - проверить валидность кода');
  console.log('  codec.getStats(orig, min)   - статистика сжатия');
  console.log('');
  console.log('📋 Пример:');
  console.log('  const minified = codec.minify(`');
  console.log('    function hello(name) {');
  console.log('      console.log("Hello " + name);');
  console.log('    }');
  console.log('  `);');
  console.log('  console.log(minified);');
}
