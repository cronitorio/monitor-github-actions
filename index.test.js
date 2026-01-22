const { slugify, extractSchedule, getMonitorState, getKey } = require('./index')

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Deploy (Production)')).toBe('deploy-production')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('Test -- Build')).toBe('test-build')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Test--  ')).toBe('test')
  })

  it('handles complex workflow names', () => {
    expect(slugify('CI/CD Pipeline - Main Branch')).toBe('cicd-pipeline-main-branch')
  })
})

describe('extractSchedule', () => {
  it('extracts cron schedule from workflow content', () => {
    const content = `
name: Test Workflow
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
`
    expect(extractSchedule(content)).toBe('0 6 * * *')
  })

  it('handles double-quoted cron expressions', () => {
    const content = `
on:
  schedule:
    - cron: "30 5 * * 1-5"
`
    expect(extractSchedule(content)).toBe('30 5 * * 1-5')
  })

  it('returns null when no schedule is present', () => {
    const content = `
name: Test Workflow
on:
  push:
    branches: [main]
`
    expect(extractSchedule(content)).toBe(null)
  })

  it('returns null for empty content', () => {
    expect(extractSchedule('')).toBe(null)
  })
})

describe('getMonitorState', () => {
  it('returns "complete" for successful completion', () => {
    const event = {
      action: 'completed',
      workflow_run: { conclusion: 'success' }
    }
    expect(getMonitorState(event)).toBe('complete')
  })

  it('returns "fail" for failed completion', () => {
    const event = {
      action: 'completed',
      workflow_run: { conclusion: 'failure' }
    }
    expect(getMonitorState(event)).toBe('fail')
  })

  it('returns "run" for requested action', () => {
    const event = {
      action: 'requested',
      workflow_run: {}
    }
    expect(getMonitorState(event)).toBe('run')
  })

  it('returns undefined for other actions', () => {
    const event = {
      action: 'in_progress',
      workflow_run: {}
    }
    expect(getMonitorState(event)).toBeUndefined()
  })
})

describe('getKey', () => {
  it('generates key with gh- prefix and slugified name', () => {
    const event = {
      workflow: { name: 'Deploy Production' }
    }
    expect(getKey(event)).toBe('gh-deploy-production')
  })

  it('handles workflow names with special characters', () => {
    const event = {
      workflow: { name: 'CI/CD (Main)' }
    }
    expect(getKey(event)).toBe('gh-cicd-main')
  })
})
