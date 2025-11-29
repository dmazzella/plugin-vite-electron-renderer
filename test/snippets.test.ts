import { describe, it, expect } from 'vitest'
import { 
  generateElectronSnippet,
  generateCjsWrapperSnippet,
  generateBuiltinSnippet 
} from '../src/snippets.js'

describe('snippets', () => {
  describe('generateElectronSnippet', () => {
    it('should generate valid electron polyfill code', () => {
      const snippet = generateElectronSnippet()
      
      // Should contain electron require
      expect(snippet).toContain('require("electron")')
      
      // Should export renderer APIs
      expect(snippet).toContain('export const ipcRenderer')
      expect(snippet).toContain('export const clipboard')
      expect(snippet).toContain('export const contextBridge')
      expect(snippet).toContain('export const shell')
      expect(snippet).toContain('export const nativeImage')
      expect(snippet).toContain('export const webFrame')
      
      // Should export main-only APIs (as undefined)
      expect(snippet).toContain('export const app')
      expect(snippet).toContain('export const BrowserWindow')
      expect(snippet).toContain('export const Menu')
      
      // Should have default export
      expect(snippet).toContain('export default')
      
      // Should have Worker proxy for ipcRenderer
      expect(snippet).toContain('Web Worker')
      expect(snippet).toContain('Proxy')
    })
  })
  
  describe('generateCjsWrapperSnippet', () => {
    it('should generate ESM wrapper for CJS module', () => {
      const snippet = generateCjsWrapperSnippet('test-module', ['default', 'foo', 'bar'])
      
      // Should use require
      expect(snippet).toContain('require("test-module")')
      
      // Should have default export
      expect(snippet).toContain('export default')
      
      // Should have named exports
      expect(snippet).toContain('export const foo')
      expect(snippet).toContain('export const bar')
      
      // Should not export 'default' as named export
      expect(snippet).not.toContain('export const default')
    })
  })
  
  describe('generateBuiltinSnippet', () => {
    it('should generate wrapper for Node.js builtin', () => {
      const snippet = generateBuiltinSnippet('fs')
      
      // Should use require
      expect(snippet).toContain('require("fs")')
      
      // Should have default export
      expect(snippet).toContain('export default')
      
      // Should have common fs exports
      expect(snippet).toContain('readFile')
      expect(snippet).toContain('writeFile')
      expect(snippet).toContain('existsSync')
    })
  })
})
