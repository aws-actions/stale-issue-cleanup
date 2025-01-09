import * as github from "@actions/github";
import * as core from "@actions/core";
import type { Endpoints } from "@octokit/types";
import type { Inputs } from "./entrypoint";

const MS_PER_DAY = 86400000;

type issueType = Endpoints['GET /repos/{owner}/{repo}/issues']['response']['data'][0];
type issueTimelineEventsType = Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/timeline']['response']['data'][0];

export async function closeIssue(client: github.GitHub, issue: issueType, cfsLabel: string) {
    core.debug(`closing issue #${issue.number} for staleness`);
    if (cfsLabel && cfsLabel !== '') {
        await client.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issue.number,
            labels: [cfsLabel]
        });
    }
    await client.issues.update({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        state: 'closed'
    });
};

export async function removeLabel(client: github.GitHub, issue: issueType, label: string) {
    core.debug(`removing label ${label} from issue #${issue.number}`);
    await client.issues.removeLabel({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        name: label
    });
};

export async function markStale(client: github.GitHub, issue: issueType, staleMessage: string, staleLabel: string) {
    core.debug(`marking issue #${issue.number} as stale`);
    await client.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        body: staleMessage,
    });
    await client.issues.addLabels({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        labels: [staleLabel],
    });
};

export function getTimelineEvents(client: github.GitHub, issue: issueType): Promise<issueTimelineEventsType> {
    const options = client.issues.listEventsForTimeline.endpoint.merge({
        issue_number: issue.number,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        per_page: 100,
    });
    return client.paginate(options).then((events) => {
        return events[events.length - 1];
    });
}

export async function getIssues(client: github.GitHub, args: Inputs): Promise<Array<issueType>> {
    let responseIssues = [];
    let staleIssues = [];
    let stalePrs = [];
    let ancientIssues = [];

    let options = client.issues.listForRepo.endpoint.merge({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        state: 'open',
        labels: args.responseRequestedLabel,
        per_page: 100,
    });
    responseIssues = await client.paginate(options);
    core.debug(`found ${responseIssues.length} response-requested issues`);

    if (args.staleIssueMessage && args.staleIssueMessage !== '') {
        options = client.issues.listForRepo.endpoint.merge({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            state: 'open',
            labels: args.stateIssueLabel,
            per_page: 100,
        });
        staleIssues = await client.paginate(options);
        core.debug(`found ${staleIssues.length} stale issues`);
    } else {
        core.debug("skipping stale issues due to empty message");
    }

    if (args.stalePrMessage && args.stalePrMessage !== '') {
        options = client.issues.listForRepo.endpoint.merge({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            state: 'open',
            labels: args.statePrLabel,
            per_page: 100,
        });
        stalePrs = await client.paginate(options);
        core.debug(`found ${stalePrs.length} stale PRs`);
    } else {
        core.debug("skipping stale PRs due to empty message");
    }

    if (args.ancientIssueMessage && args.ancientIssueMessage !== '') {
        core.debug(`using issue ${args.useCreatedDateForAncient ? "created date" : "last updated"} to determine for getting ancient issues.`);
        options = client.issues.listForRepo.endpoint.merge({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            state: 'open',
            per_page: 100,
            sort: 'updated',
            direction: 'asc',
        });
        const ancientResults = await client.paginate(options);
        ancientIssues = ancientResults.filter(
            (issue) =>
                (args.useCreatedDateForAncient ? new Date(issue.created_at) : new Date(issue.updated_at)) <
                new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient)
        );
        core.debug(`found ${ancientIssues.length} ancient issues`);
    } else {
        core.debug("skipping ancient issues due to empty message");
    }
    
    const issues = [
        ...responseIssues,
        ...staleIssues,
        ...stalePrs,
        ...ancientIssues,
    ];
    return Object.values(
        issues.reduce((unique, item) => {
            unique[`${item.id}`] = item;
            return unique;
        }, [])
    );
};

export async function hasEnoughUpvotes(client: github.GitHub, issueNumber: number, upvoteCount: number): Promise<boolean> {
    const options = client.reactions.listForIssue.endpoint.merge({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issueNumber,
        mediaType: { previews: ['squirrel-girl-preview'] },
        per_page: 100,
    });
    const reactions = await client.paginate(options);
    if (reactions) {
        const upvotes = reactions.reduce((acc: number, cur: { content: string; }) => {
            if (
                cur.content === '+1' ||
                cur.content === 'heart' ||
                cur.content === 'hooray' ||
                cur.content === 'rocket' 
            ) {
                return acc + 1;
            }
            return acc;
        });
        return upvotes >= upvoteCount;
    } 
    return false;
};