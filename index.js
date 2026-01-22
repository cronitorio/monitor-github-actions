const core = require('@actions/core');
const github = require('@actions/github');
const cronitor = require('cronitor')(core.getInput('cronitor_key'), {
  apiVersion: '2025-11-28'
});

/**
 * Slugify a string to create a URL-safe key
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w-]+/g, '')     // Remove all non-word chars except -
    .replace(/--+/g, '-')        // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start
    .replace(/-+$/, '');         // Trim - from end
}

/**
 * Extract all cron schedules from workflow content
 */
function extractSchedules(workflowContent) {
  const lines = workflowContent.split('\n');
  const schedules = [];
  let inSchedule = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'schedule:') {
      inSchedule = true;
      continue;
    }

    if (inSchedule) {
      // Check for cron line
      const cronMatch = trimmed.match(/^-?\s*cron:\s*['"]?([^'"]+)['"]?$/);
      if (cronMatch) {
        schedules.push(cronMatch[1].trim());
        continue;
      }
      // If we hit another top-level key, stop looking
      if (trimmed.match(/^[a-z_]+:/) && !trimmed.startsWith('-')) {
        break;
      }
    }
  }

  return schedules.length > 0 ? schedules : null;
}

/**
 * Fetch workflow file content to get schedule
 */
async function getWorkflowSchedule(event) {
  const token = core.getInput('github_token');
  if (!token) {
    core.debug('No github_token provided, skipping schedule fetch');
    return null;
  }

  try {
    const octokit = github.getOctokit(token);
    const [owner, repo] = event.repository.full_name.split('/');

    // Get workflow details to find the file path
    const { data: workflow } = await octokit.rest.actions.getWorkflow({
      owner,
      repo,
      workflow_id: event.workflow.id
    });

    // Fetch the workflow file content
    const { data: fileContent } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: workflow.path
    });

    if (fileContent.content) {
      const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      return extractSchedules(content);
    }
  } catch (error) {
    core.debug(`Failed to fetch workflow schedule: ${error.message}`);
  }

  return null;
}

async function run() {
  try {
    core.info('** Cronitor for Github Actions **');
    core.debug(core.getInput('event'))

    core.setSecret(core.getInput('cronitor_key'))
    core.setSecret(core.getInput('github_token'))
    if (!core.getInput('event')) {
      core.setFailed('Invalid event input: workflow_run JSON expected')
      return null
    }

    const event = JSON.parse(core.getInput('event'))
    if (!event?.workflow) {
      core.setFailed('Invalid event input: workflow_run JSON expected')
      return null
    }

    const monitor = await putMonitorDetails(event)
    core.debug(monitor)

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
    key: getKey(event),
    defaultNote: 'View this workflow on Github:\n' +
      event.workflow.html_url,
  }

  // Fetch and add schedules if available
  const schedules = await getWorkflowSchedule(event)
  if (schedules) {
    core.info(`Found workflow schedules: ${schedules.join(', ')}`)
    payload['schedules'] = schedules
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
  const monitor = new cronitor.Monitor(getKey(event));
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

function getGuidKey(event) {
  return `${event.repository.id}-${event.workflow.id}`
}

function getSlugifiedKey(event) {
  return `gh-${slugify(event.workflow.name)}`
}

function getKey(event) {
  const keyFormat = core.getInput('key_format') || 'slugified'
  if (keyFormat === 'guid') {
    return getGuidKey(event)
  }
  return getSlugifiedKey(event)
}

// Only run when executed directly (not when imported for testing)
if (require.main === module) {
  run()
}

module.exports = {
  slugify,
  extractSchedules,
  getMonitorState,
  getKey,
  getGuidKey,
  getSlugifiedKey
}
