const core = require('@actions/core');
const cronitor = require('cronitor')(core.getInput('cronitor_key'));

async function run() {
  try {
    core.info('** Cronitor for Github Actions **');
    core.setSecret(core.getInput('cronitor_key'))
    core.info(core.getInput('event'))

    const event = JSON.parse(core.getInput('event'))
    if (!event?.workflow) {
      core.setFailed('Invalid event input: workflow_run JSON expected')
      return null
    }

    await putMonitorDetails(event)
    return sendTelemetry(event)
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function putMonitorDetails(event) {
  core.info('Syncing workflow details to Cronitor')
  const cronitor_group = core.getInput('cronitor_group')
  const cronitor_notify = core.getInput('cronitor_notify')

  const payload = {
    type: 'job',
    platform: 'github actions',
    name: event.workflow.name,
    key: event.workflow.id,
    defaultNote: 'Automatically synced using Cronitor for Github Actions. View this workflow on Github: ' +
      event.workflow.html_url,
  }

  if (cronitor_group) {
    payload['group'] = cronitor_group
  }
  if (cronitor_notify) {
    payload['notify'] = [cronitor_notify]
  }

  return cronitor.Monitor.put(payload)
}

async function sendTelemetry(event) {
  core.info('Sending telemetry to Cronitor');
  const monitor = new cronitor.Monitor(event.workflow.id);
  const monitorState = getMonitorState(event)

  if (!monitorState) {
    core.info('No telemetry to send for this event');
    return
  }

  return monitor.ping({
    state: monitorState,
    series: event.workflow_run.id,
    message: getMessage({event, monitorState})
  })
}

function getMonitorState(event) {
  if (event.action === 'completed' && event.workflow_run.conclusion === 'success') {
    return 'complete'
  }

  if (event.action === 'completed' && event.workflow_run.conclusion === 'failure') {
    return 'fail'
  }

  if (event.action === 'requested') {
    return 'run'
  }
}

function getMessage({event, monitorState}) {
  if (monitorState === 'run') {
    return event.workflow_run.html_url
  }
}


run()
