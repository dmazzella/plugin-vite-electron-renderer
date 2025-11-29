import { describe, it, expect } from 'vitest'
import { 
  NODE_BUILTINS, 
  ALL_BUILTINS, 
  ELECTRON_MAIN_APIS,
  getMainOnlyApis 
} from '../src/constants.js'

describe('constants', () => {
  it('should have Node.js builtins without internal modules', () => {
    expect(NODE_BUILTINS).not.toContain('_http_agent')
    expect(NODE_BUILTINS).not.toContain('_stream_readable')
    expect(NODE_BUILTINS).toContain('fs')
    expect(NODE_BUILTINS).toContain('path')
    expect(NODE_BUILTINS).toContain('crypto')
  })
  
  it('should have all builtins including electron and node: prefixes', () => {
    expect(ALL_BUILTINS).toContain('electron')
    expect(ALL_BUILTINS).toContain('fs')
    expect(ALL_BUILTINS).toContain('node:fs')
    expect(ALL_BUILTINS).toContain('path')
    expect(ALL_BUILTINS).toContain('node:path')
  })
  
  it('should have Electron API definitions', () => {
    expect(ELECTRON_MAIN_APIS.length).toBeGreaterThan(0)
    
    const appApi = ELECTRON_MAIN_APIS.find((api) => api.name === 'app')
    expect(appApi).toBeDefined()
    expect(appApi?.environments).toEqual(['Main'])
    
    const clipboardApi = ELECTRON_MAIN_APIS.find((api) => api.name === 'clipboard')
    expect(clipboardApi).toBeDefined()
    expect(clipboardApi?.environments).toContain('Main')
    expect(clipboardApi?.environments).toContain('Renderer')
    
    const browserViewApi = ELECTRON_MAIN_APIS.find((api) => api.name === 'BrowserView')
    expect(browserViewApi).toBeDefined()
    expect(browserViewApi?.deprecated).toBe(true)
  })
  
  it('should get main-only APIs', () => {
    const mainOnly = getMainOnlyApis()
    
    expect(mainOnly).toContain('app')
    expect(mainOnly).toContain('BrowserWindow')
    expect(mainOnly).toContain('Menu')
    
    // These are available in Renderer too, so shouldn't be in mainOnly
    expect(mainOnly).not.toContain('clipboard')
    expect(mainOnly).not.toContain('shell')
    expect(mainOnly).not.toContain('nativeImage')
  })
})
