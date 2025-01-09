import * as core from '@actions/core';
import type { Endpoints } from '@octokit/types';
import dateformat from 'dateformat';

export type issueType = Endpoints['GET /repos/{owner}/{repo}/issues']['response']['data'][0];
export type issueTimelineEventsType =
  Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/timeline']['response']['data'][0];

export function isLabeled(issue: issueType, label: string) {
  if ('labels' in issue) {
    const foundone = issue.labels.some((labelObj) => {
      if (typeof labelObj === 'string') {
        return labelObj === label;
      }
      return labelObj.name === label;
    });
    if (foundone) {
      core.debug(`issue has label ${label}`);
    } else {
      core.debug(`issue doesn't have label ${label}`);
    }
    return foundone;
  }
  core.debug(`no labels detail in #${issue}`);
  return false;
}

export function revCompareEventsByDate(a: issueTimelineEventsType, b: issueTimelineEventsType): 1 | 0 | -1 {
  if ('created_at' in a && 'created_at' in b) {
    const dateA = Date.parse(a.created_at);
    const dateB = Date.parse(b.created_at);
    if (dateA < dateB) {
      return 1;
    }
    if (dateA === dateB) {
      return 0;
    }
    return -1;
  }
  return 0;
}

export function getLastLabelTime(events: issueTimelineEventsType[], label: string): Date | undefined {
  const labelEvents = events.filter((event) => event.event === 'labeled');
  const searchedLabelEvents = labelEvents.filter((event) => {
    if ('label' in event) {
      return event.label.name === label;
    }
    return false;
  });
  const validLabelEvents = searchedLabelEvents.filter(
    (event): event is issueTimelineEventsType & { created_at: string } => {
      return 'created_at' in event;
    },
  );
  if (validLabelEvents.length > 0) {
    validLabelEvents.sort(revCompareEventsByDate);
    return new Date(Date.parse(validLabelEvents[0].created_at));
  }
  core.info(`Could not find a ${label} label event in this issue's timeline. Was this label renamed?`);
  return undefined;
}

export function getLastCommentTime(events: issueTimelineEventsType[]): Date | undefined {
  const commentEvents = events.filter((event) => event.event === 'commented');
  if (commentEvents.length > 0) {
    core.debug('issue has comments');
    commentEvents.sort(revCompareEventsByDate);
    if ('created_at' in commentEvents[0]) {
      return new Date(Date.parse(commentEvents[0].created_at));
    }
  }
  // No comments on issue, so use *all events*
  core.debug('issue has no comments');
  events.sort(revCompareEventsByDate);
  if ('created_at' in events[0]) {
    return new Date(Date.parse(events[0].created_at));
  }
  return undefined;
}

export function asyncForEach<T>(_array: T[], _callback: (item: T, index: number, array: T[]) => Promise<void>): never {
  throw new Error('Use Promise.all or Promise.allSettled instead');
}

export function dateFormatToIsoUtc(dateTime: Date | string | number): string {
  return dateformat(dateTime, 'isoUtcDateTime');
}

export function parseCommaSeparatedString(s: string): string[] {
  if (!s.length) return [];
  return s.split(',').map((e) => e.trim());
}
