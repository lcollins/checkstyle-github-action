import * as core from '@actions/core'
import {findResults} from './search'
import {Inputs, Outputs} from './constants'
import {annotationsForPath} from './annotations'
import {chain, groupBy, splitEvery} from 'ramda'
import {Annotation, AnnotationLevel} from './github'
import {context, getOctokit} from '@actions/github'

const MAX_ANNOTATIONS_PER_REQUEST = 50

export async function run(): Promise<void> {
  try {
    const path = core.getInput(Inputs.Path, {required: true})
    const name = core.getInput(Inputs.Name)
    const title = core.getInput(Inputs.Title)
    const checkRun = core.getInput(Inputs.CheckRun).toLowerCase() !== 'false'

    const searchResult = await findResults(path)
    if (searchResult.filesToUpload.length === 0) {
      core.warning(
        `No files were found for the provided path: ${path}. No results will be uploaded.`
      )
    } else {
      core.info(
        `With the provided path, there will be ${searchResult.filesToUpload.length} results uploaded`
      )
      core.debug(`Root artifact directory is ${searchResult.rootDirectory}`)

      const annotations: Annotation[] = chain(
        annotationsForPath,
        searchResult.filesToUpload
      )
      core.debug(
        `Grouping ${annotations.length} annotations into chunks of ${MAX_ANNOTATIONS_PER_REQUEST}`
      )

      const groupedAnnotations: Annotation[][] =
        annotations.length > MAX_ANNOTATIONS_PER_REQUEST
          ? splitEvery(MAX_ANNOTATIONS_PER_REQUEST, annotations)
          : [annotations]

      core.debug(`Created ${groupedAnnotations.length} buckets`)

      const conclusion = getConclusion(annotations)

      const annotationsByLevel: {[p: string]: Annotation[]} = groupBy(
        a => a.annotation_level,
        annotations
      )
      const numFailures = (
        annotationsByLevel[AnnotationLevel.failure] || []
      ).length
      const numWarnings = (
        annotationsByLevel[AnnotationLevel.warning] || []
      ).length
      const numNotices = (
        annotationsByLevel[AnnotationLevel.notice] || []
      ).length

      let checkHref = ''
      if (checkRun) {
        for (const annotationSet of groupedAnnotations) {
          const href = await createCheck(
            name,
            title,
            annotationSet,
            annotations.length,
            conclusion
          )
          if (!checkHref && href) {
            checkHref = href
          }
        }
      } else {
        core.info('Check run creation is disabled via check_run input')
      }

      core.setOutput(Outputs.Conclusion, conclusion)
      core.setOutput(Outputs.Violations, annotations.length)
      core.setOutput(Outputs.Failures, numFailures)
      core.setOutput(Outputs.Warnings, numWarnings)
      core.setOutput(Outputs.Notices, numNotices)
      core.setOutput(Outputs.CheckHref, checkHref)
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error : String(error))
  }
}

function getConclusion(
  annotations: Annotation[]
): 'success' | 'failure' | 'neutral' {
  if (annotations.length === 0) {
    return 'success'
  }

  const annotationsByLevel: {[p: string]: Annotation[]} = groupBy(
    a => a.annotation_level,
    annotations
  )

  if (
    annotationsByLevel[AnnotationLevel.failure] &&
    annotationsByLevel[AnnotationLevel.failure].length
  ) {
    return 'failure'
  } else if (
    annotationsByLevel[AnnotationLevel.warning] &&
    annotationsByLevel[AnnotationLevel.warning].length
  ) {
    return 'neutral'
  }

  return 'success'
}

async function createCheck(
  name: string,
  title: string,
  annotations: Annotation[],
  numErrors: number,
  conclusion: 'success' | 'failure' | 'neutral'
): Promise<string> {
  core.info(
    `Uploading ${annotations.length} / ${numErrors} annotations to GitHub as ${name} with conclusion ${conclusion}`
  )
  const octokit = getOctokit(core.getInput(Inputs.Token))
  let sha = context.sha

  if (context.payload.pull_request) {
    sha = context.payload.pull_request.head.sha
  }

  const req = {
    ...context.repo,
    ref: sha
  }

  const res = await octokit.rest.checks.listForRef(req)
  const existingCheckRun = res.data.check_runs.find(
    check => check.name === name
  )

  if (!existingCheckRun) {
    const createRequest = {
      ...context.repo,
      head_sha: sha,
      conclusion,
      name,
      status: 'completed' as const,
      output: {
        title,
        summary: `${numErrors} violation(s) found`,
        annotations
      }
    }

    const createRes = await octokit.rest.checks.create(createRequest)
    return createRes.data.html_url || ''
  } else {
    const check_run_id = existingCheckRun.id

    const update_req = {
      ...context.repo,
      conclusion,
      check_run_id,
      status: 'completed' as const,
      output: {
        title,
        summary: `${numErrors} violation(s) found`,
        annotations
      }
    }

    const updateRes = await octokit.rest.checks.update(update_req)
    return updateRes.data.html_url || ''
  }
}

run()
