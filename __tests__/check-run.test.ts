import * as path from 'path'

// Variables prefixed with 'mock' are accessible inside jest.mock factories due to hoisting
const mockCreate = jest.fn()
const mockUpdate = jest.fn()
const mockListForRef = jest.fn()
const mockSetOutput = jest.fn()
const mockGetInput = jest.fn()
const mockInfo = jest.fn()
const mockWarning = jest.fn()
const mockSetFailed = jest.fn()
const mockFindResults = jest.fn()

jest.mock('@actions/core', () => ({
  getInput: mockGetInput,
  setOutput: mockSetOutput,
  info: mockInfo,
  warning: mockWarning,
  setFailed: mockSetFailed,
  debug: jest.fn(),
  error: jest.fn()
}))

jest.mock('@actions/github', () => ({
  context: {
    repo: {owner: 'owner', repo: 'repo'},
    sha: 'abc123',
    payload: {}
  },
  getOctokit: jest.fn(() => ({
    rest: {
      checks: {
        create: mockCreate,
        update: mockUpdate,
        listForRef: mockListForRef
      }
    }
  }))
}))

jest.mock('../src/search', () => ({
  findResults: mockFindResults
}))

import {run} from '../src/main'

const reportPath = path.resolve(
  __dirname,
  '..',
  'reports',
  'checkstyle-result.xml'
)

function setupInputs(checkRun: string): void {
  mockGetInput.mockImplementation((name: string) => {
    const inputs: Record<string, string> = {
      path: reportPath,
      name: 'Checkstyle',
      title: 'Checkstyle Report',
      token: 'fake-token',
      check_run: checkRun
    }
    return inputs[name] ?? ''
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockListForRef.mockResolvedValue({data: {check_runs: []}})
  mockCreate.mockResolvedValue({
    data: {html_url: 'https://github.com/owner/repo/runs/1'}
  })
  mockFindResults.mockResolvedValue({
    filesToUpload: [reportPath],
    rootDirectory: path.dirname(reportPath)
  })
})

test('skips check run creation when check_run is false', async () => {
  setupInputs('false')

  await run()

  expect(mockCreate).not.toHaveBeenCalled()
  expect(mockUpdate).not.toHaveBeenCalled()
  expect(mockInfo).toHaveBeenCalledWith(
    'Check run creation is disabled via check_run input'
  )
})

test('creates check run when check_run is true', async () => {
  setupInputs('true')

  await run()

  expect(mockCreate).toHaveBeenCalled()
  expect(mockInfo).not.toHaveBeenCalledWith(
    'Check run creation is disabled via check_run input'
  )
})

test('creates check run when check_run defaults to empty string', async () => {
  setupInputs('')

  await run()

  expect(mockCreate).toHaveBeenCalled()
  expect(mockInfo).not.toHaveBeenCalledWith(
    'Check run creation is disabled via check_run input'
  )
})
