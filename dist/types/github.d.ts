import * as github from '@actions/github';
import type { Inputs } from './entrypoint';
import type { issueTimelineEventsType, issueType } from './utils';
export declare function closeIssue(client: ReturnType<typeof github.getOctokit>, issue: issueType, cfsLabel: string): Promise<void>;
export declare function removeLabel(client: ReturnType<typeof github.getOctokit>, issue: issueType, label: string): Promise<void>;
export declare function markStale(client: ReturnType<typeof github.getOctokit>, issue: issueType, staleMessage: string, staleLabel: string): Promise<void>;
export declare function getTimelineEvents(client: ReturnType<typeof github.getOctokit>, issue: issueType): Promise<issueTimelineEventsType[]>;
export declare function getIssues(client: ReturnType<typeof github.getOctokit>, args: Inputs): Promise<Array<issueType>>;
export declare function hasEnoughUpvotes(client: ReturnType<typeof github.getOctokit>, issueNumber: number, upvoteCount: number): Promise<boolean>;
