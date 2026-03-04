import * as process from 'process'
import fs from 'fs'
import * as path from 'path'
import {annotationsForPath} from '../src/annotations'
import {Inputs} from '../src/constants'

beforeAll(() => {
  jest.spyOn(fs, 'existsSync').mockReturnValue(true)
  process.env['GITHUB_WORKSPACE'] = __dirname
})

test('parses file', async () => {
  const report = path.resolve(
    __dirname,
    '..',
    'reports',
    'checkstyle-result.xml'
  )
  const annotations = annotationsForPath(report)
  expect(annotations).toHaveLength(1928)
})

test('Inputs enum includes AnnotationGeneration', () => {
  expect(Inputs.AnnotationGeneration).toBe('annotation_generation')
})
