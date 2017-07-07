// @flow

import { logger } from '@amazeeio/amazeeio-local-logging';

import { sendToAmazeeioLogs } from '@amazeeio/amazeeio-logs';

import { createDeployTask } from '@amazeeio/amazeeio-tasks';

import { getEnabledSystemsForSiteGroup } from '@amazeeio/amazeeio-api';

import type { WebhookRequestData, deployData, ChannelWrapper, SiteGroup  } from '../types';

export default async function githubPush(webhook: WebhookRequestData, siteGroup: SiteGroup) {

    const {
      webhooktype,
      event,
      giturl,
      uuid,
      body,
    } = webhook;

    const branchName = body.ref.toLowerCase().replace('refs/heads/','')
    const sha = body.after

    const meta = {
      branch: branchName,
      sha: sha
    }

    const data: deployData = {
      siteGroupName: siteGroup.siteGroupName,
      type: 'branch',
      branchName: branchName,
      sha: sha
    }

    let logMessage = ''
    if (sha) {
      logMessage = `\`${meta.branch}\` (${sha.substring(0, 7)})`
    } else {
      logMessage = `\`${meta.branch}\``
    }

    try {
      const taskResult = await createDeployTask(data);
      sendToAmazeeioLogs('info', siteGroup.siteGroupName, uuid, `${webhooktype}:${event}:handled`, meta,
        `*[${siteGroup.siteGroupName}]* ${logMessage} pushed in <${body.repository.html_url}|${body.repository.full_name}>`
      )
      return;
    } catch (error) {
      switch (error.name) {
        case "SiteGroupNotFound":
        case "NoActiveSystemsDefined":
        case "UnknownActiveSystem":
        case "NoNeedToDeployBranch":
          // These are not real errors and also they will happen many times. We just log them locally but not throw an error
          sendToAmazeeioLogs('info', siteGroup.siteGroupName, uuid, `${webhooktype}:${event}:handledButNoTask`, meta,
            `*[${siteGroup.siteGroupName}]* ${logMessage}. No deploy task created, reason: ${error}`
          )
          return;

        default:
          // Other messages are real errors and should reschedule the message in RabbitMQ in order to try again
          throw error
      }
    }

}