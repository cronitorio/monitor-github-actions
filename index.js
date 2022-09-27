const core = require('@actions/core');
const cronitor = require('cronitor')(core.getInput('cronitor_key'));

async function run() {
  try {
    core.info('** Cronitor for Github Actions **');
    core.setSecret(core.getInput('cronitor_key'))
    if (!core.getInput('event').workflow) {
      core.setFailed('Invalid event input: JSON expected')
      return null
    }
    await putMonitorDetails()
    return sendTelemetry()
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function putMonitorDetails() {
  core.info('Syncing workflow details to Cronitor')
  const event = core.getInput('event')
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

async function sendTelemetry() {
  core.info('Sending telemetry to Cronitor');
  const event = core.getInput('event')
  const monitor = new cronitor.Monitor(event.workflow.id);
  const monitorState = getMonitorState()

  if (!monitorState) {
    core.info('No telemetry to send for this event');
    return
  }

  return monitor.ping({
    state: monitorState,
    series: event.workflow_run.id,
    message: getMessage(monitorState),
  })
}

function getMonitorState() {
  const event = core.getInput('event')
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

function getMessage(monitorState) {
  const event = core.getInput('event')
  if (monitorState === 'run') {
    return event.workflow_run.html_url
  }
}


run()
