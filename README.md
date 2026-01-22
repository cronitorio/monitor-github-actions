# Monitor Github Actions by Cronitor

Automatically monitor Github Actions Workflows using [Cronitor.io](https://cronitor.io) and a simple Github Action. 

## Features

- #### Automatically sync workflows to Cronitor when they run, no manual configuration. 
- #### Send telemetry to Cronitor when jobs start, complete and fail. 
- #### Monitor every workflow in your repo, or easily limit to specific workflows.

## Usage

1. #### Add a ``CRONITOR_API_KEY`` secret in your repo, copying your Cronitor API key from https://cronitor.io/app/settings/api
2. #### Add a new ``cronitor.yml`` workflow to your repo, copying this example yaml. Push the new workflow to your ``main`` branch.  
3. #### Done! The Cronitor Monitoring Relay will be invoked automatically for every workflow that runs in your repo.
```yaml
name: Cronitor Monitoring Relay

on:
  workflow_run:
    workflows: ['*']
    types: [requested,completed]

jobs:
  send-telemetry:
    runs-on: ubuntu-latest
    name: Send Telemetry
    steps:
      - name: Send execution details to the Cronitor for Github Actions agent
        uses: cronitorio/monitor-github-actions@v8
        with:
          event: ${{ toJSON(github.event) }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          cronitor_key: ${{ secrets.CRONITOR_API_KEY }}
          cronitor_group: actions
          cronitor_notify: devops-alerts

```

## Parameters

| Parameter name      | Required | Description                                        |
|---------------------|----------|----------------------------------------------------|
| ``event``           | Yes      | Triggering event (passed from ``github.event``)    |
| ``cronitor_key``    | Yes      | Your Cronitor API key                              |
| ``github_token``    | No       | Used to fetch workflow schedules from your repo    |
| ``cronitor_group``  | No       | Add monitors to a Cronitor group                   |
| ``cronitor_notify`` | No       | A notification list to use for alerts              |
| ``key_format``      | No       | Monitor key format: ``slugified`` (default) or ``guid`` | 

## Monitoring Specific Workflows
By default, when you add the YAML for the Cronitor Monitoring Relay as an Action, it will be invoked automatically for every 
workflow that runs in this repo. If you want to limit which workflows are monitored by Cronitor, you can specify those
directly in the ``on`` clause of your Cronitor workflow yaml:

```yaml
on:
  workflow_run:
    workflows: [job1,job2]
    types: [requested,completed]
```

## Configuring Alerts

### Recipients
Alert recipients can be managed directly from this configuration file using the optional ``cronitor_notify`` input.
Provide a [notification list](https://cronitor.io/app/settings/alerts) using its key, or specify a single recipient, e.g.
`email:shane@cronitor.io`.

### Alert Settings
After adding the Cronitor Relay yaml, your workflows will appear on your Cronitor dashboard the first time they run. From the 
dashboard, you will be able to customize alert preferences, including:
- Be alerted only if a workflow persistently fails 
- Be alerted if a workflow does not run or complete at least once in a given time span.  
- Be alerted on workflow execution time and avoid surprise charges from Github.

## Changelog

### v8
- **Schedule sync**: Workflows with a `schedule` trigger now automatically sync their cron schedule to Cronitor.
- **Cleaner monitor keys**: Monitor keys now use a slugified workflow name format (`gh-my-workflow-name`) instead of numeric IDs.
- **Backwards compatibility**: Existing users can set `key_format: guid` to keep using the old key format and preserve their existing monitors.

