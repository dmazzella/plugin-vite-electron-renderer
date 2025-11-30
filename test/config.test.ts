import { describe, it, expect } from 'vitest'
import { builtinModules } from 'node:module'
import { resolveConfig, type UserConfig, type Alias } from 'vite'
import type { OutputOptions, RollupOptions } from 'rollup'
import electronRenderer from '../src/index.js'

const builtins = [
  'electron',
  ...builtinModules.filter((m) => !m.startsWith('_')),
  ...builtinModules.filter((m) => !m.startsWith('_')).map((mod) => `node:${mod}`),
]

// Helper to filter out Vite internal aliases
function excludeViteAlias(aliases: readonly Alias[]): Alias[] {
  return aliases.filter((a) => {
    const findStr = typeof a.find === 'string' ? a.find : a.find.toString()
    return !findStr.includes('@vite')
  })
}

describe('plugin config', () => {
  it('should set base to ./ by default', async () => {
    const config = await resolveConfig({
      configFile: false,
      plugins: [electronRenderer()],
    }, 'build')
    
    expect(config.base).toBe('./')
  })
  
  it('should not override user-defined base', async () => {
    const config = await resolveConfig({
      configFile: false,
      base: '/custom/',
      plugins: [electronRenderer()],
    }, 'build')
    
    expect(config.base).toBe('/custom/')
  })
  
  it('should set rollup output freeze to false', async () => {
    const getConfig = (output: RollupOptions['output']) => resolveConfig({
      configFile: false,
      build: {
        rollupOptions: { output },
      },
      plugins: [electronRenderer()],
    }, 'build')
    
    // Single output
    const singleOutput = (await getConfig({})).build.rollupOptions.output as OutputOptions
    expect(singleOutput.freeze).toBe(false)
    
    // Array output
    const arrayOutput = (await getConfig([{}])).build.rollupOptions.output as OutputOptions[]
    for (const out of arrayOutput) {
      expect(out.freeze).toBe(false)
    }
  })
  
  it('should configure commonjs ignore for builtins', async () => {
    const getConfig = (commonjsOptions: NonNullable<UserConfig['build']>['commonjsOptions']) => 
      resolveConfig({
        configFile: false,
        build: { commonjsOptions },
        plugins: [electronRenderer()],
      }, 'build')
    
    // Array ignore
    const ignoreArray = (await getConfig({ ignore: [...builtins] })).build.commonjsOptions.ignore
    expect(ignoreArray).toEqual(builtins)
    
    // Function ignore
    const ignoreFunc = (await getConfig({ 
      ignore: (id) => builtins.includes(id) 
    })).build.commonjsOptions.ignore as (id: string) => boolean
    
    for (const builtin of builtins) {
      expect(ignoreFunc(builtin)).toBe(true)
    }
  })
})

describe('alias configuration', () => {
  it('should add builtin alias', async () => {
    const config = await resolveConfig({
      configFile: false,
      plugins: [electronRenderer()],
    }, 'build')
    
    const aliases = excludeViteAlias(config.resolve.alias as readonly Alias[])
    
    // Should have at least the builtin alias
    expect(aliases.length).toBeGreaterThanOrEqual(1)
    expect(aliases[0].replacement).toBe('$1')
    expect(typeof aliases[0].customResolver).toBe('function')
    
    // Verify pattern matches builtins
    const pattern = aliases[0].find as RegExp
    for (const builtin of builtins) {
      expect(builtin).toMatch(pattern)
    }
  })
  
  it('should add resolve alias when modules are configured', async () => {
    const config = await resolveConfig({
      configFile: false,
      plugins: [
        electronRenderer({
          resolve: {
            serialport: { type: 'cjs' },
            'node-fetch': { type: 'esm' },
          },
        }),
      ],
    }, 'serve')
    
    const aliases = excludeViteAlias(config.resolve.alias as readonly Alias[])
    
    // Should have builtin alias + resolve alias
    expect(aliases.length).toBe(2)
    
    // Check resolve alias pattern
    const resolvePattern = aliases[1].find as RegExp
    expect('serialport').toMatch(resolvePattern)
    expect('node-fetch').toMatch(resolvePattern)
  })
  
  it('should exclude ESM modules from resolve alias during build', async () => {
    const config = await resolveConfig({
      configFile: false,
      plugins: [
        electronRenderer({
          resolve: {
            serialport: { type: 'cjs' },
            'node-fetch': { type: 'esm' },
          },
        }),
      ],
    }, 'build')
    
    const aliases = excludeViteAlias(config.resolve.alias as readonly Alias[])
    
    // Should have builtin alias + resolve alias (only cjs)
    expect(aliases.length).toBe(2)
    
    // Check resolve alias pattern - should only match cjs modules
    const resolvePattern = aliases[1].find as RegExp
    expect('serialport').toMatch(resolvePattern)
    // node-fetch is ESM, shouldn't be in the pattern for build
    expect(resolvePattern.test('node-fetch')).toBe(false)
  })
})
