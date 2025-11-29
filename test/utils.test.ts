import { describe, it, expect } from 'vitest'
import { 
  normalizePath, 
  relativeify, 
  findNodeModules,
  ensureDir,
  fileExists 
} from '../src/utils.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('utils', () => {
  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\test\\project')).toBe('C:/Users/test/project')
      expect(normalizePath('src\\components\\Button.tsx')).toBe('src/components/Button.tsx')
    })
    
    it('should leave forward slashes unchanged', () => {
      expect(normalizePath('src/components/Button.tsx')).toBe('src/components/Button.tsx')
    })
  })
  
  describe('relativeify', () => {
    it('should add ./ prefix to relative paths', () => {
      expect(relativeify('src/index.ts')).toBe('./src/index.ts')
    })
    
    it('should not modify paths already starting with ./', () => {
      expect(relativeify('./src/index.ts')).toBe('./src/index.ts')
    })
    
    it('should not modify paths starting with ../', () => {
      expect(relativeify('../src/index.ts')).toBe('../src/index.ts')
    })
  })
  
  describe('findNodeModules', () => {
    it('should find node_modules from current directory', () => {
      const result = findNodeModules(process.cwd())
      expect(result).toContain('node_modules')
    })
  })
  
  describe('ensureDir', () => {
    it('should create directory if it does not exist', () => {
      const tempDir = path.join(os.tmpdir(), `test-ensure-${Date.now()}`)
      
      expect(fs.existsSync(tempDir)).toBe(false)
      ensureDir(tempDir)
      expect(fs.existsSync(tempDir)).toBe(true)
      
      // Cleanup
      fs.rmdirSync(tempDir)
    })
    
    it('should not throw if directory already exists', () => {
      const tempDir = path.join(os.tmpdir(), `test-ensure-exists-${Date.now()}`)
      fs.mkdirSync(tempDir)
      
      expect(() => ensureDir(tempDir)).not.toThrow()
      
      // Cleanup
      fs.rmdirSync(tempDir)
    })
  })
  
  describe('fileExists', () => {
    it('should return true for existing files', () => {
      expect(fileExists(path.join(process.cwd(), 'package.json'))).toBe(true)
    })
    
    it('should return false for non-existing files', () => {
      expect(fileExists('non-existing-file.txt')).toBe(false)
    })
  })
})
