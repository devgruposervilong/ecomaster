import { describe, expect, it } from 'vitest'
import {
  hasModuleAccess,
  modulesForRole,
  parseModules,
  type ModuleKey,
} from '@ecomaster/shared'

describe('module access', () => {
  it('da todos los módulos a admin y partner_admin', () => {
    expect(modulesForRole('admin', '[]')).toContain('catalog')
    expect(modulesForRole('partner_admin', null)).toContain('reports')
  })

  it('respeta la configuración individual de los colaboradores', () => {
    const enabled: ModuleKey[] = ['dashboard', 'catalog']
    const raw = JSON.stringify(enabled)

    expect(modulesForRole('collaborator', raw)).toEqual(enabled)
    expect(modulesForRole('partner_collaborator', raw)).toEqual(enabled)
    expect(hasModuleAccess('collaborator', raw, 'catalog')).toBe(true)
    expect(hasModuleAccess('collaborator', raw, 'sales')).toBe(false)
  })

  it('filtra módulos desconocidos y valores inválidos', () => {
    expect(parseModules('["catalog","unknown",3,"catalog"]')).toEqual(['catalog'])
    expect(parseModules('not-json')).toEqual([])
    expect(parseModules(null)).toEqual([])
  })

  it('falla cerrado para roles desconocidos', () => {
    expect(modulesForRole('partner_operator', '["catalog"]')).toEqual([])
    expect(hasModuleAccess(undefined, '["catalog"]', 'catalog')).toBe(false)
  })
})
