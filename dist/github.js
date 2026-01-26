"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeIssue = closeIssue;
exports.removeLabel = removeLabel;
exports.markStale = markStale;
exports.getTimelineEvents = getTimelineEvents;
exports.getIssues = getIssues;
exports.hasEnoughUpvotes = hasEnoughUpvotes;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const MS_PER_DAY = 86400000;
async function closeIssue(client, issue, cfsLabel) {
    core.debug(`closing issue #${issue.number} for staleness`);
    if (cfsLabel && cfsLabel !== '') {
        await client.rest.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issue.number,
            labels: [cfsLabel],
        });
    }
    await client.rest.issues.update({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        state: 'closed',
    });
}
async function removeLabel(client, issue, label) {
    core.debug(`removing label ${label} from issue #${issue.number}`);
    await client.rest.issues.removeLabel({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        name: label,
    });
}
async function markStale(client, issue, staleMessage, staleLabel) {
    core.debug(`marking issue #${issue.number} as stale`);
    await client.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        body: staleMessage,
    });
    await client.rest.issues.addLabels({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        labels: [staleLabel],
    });
}
async function getTimelineEvents(client, issue) {
    return client.paginate(client.rest.issues.listEventsForTimeline, {
        issue_number: issue.number,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        per_page: 100,
    });
}
async function getIssues(client, args) {
    const responseIssues = await client.paginate(client.rest.issues.listForRepo, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        state: 'open',
        labels: args.responseRequestedLabel,
        per_page: 100,
    });
    core.debug(`found ${responseIssues.length} response-requested issues`);
    const staleIssues = [];
    if (args.staleIssueMessage && args.staleIssueMessage !== '') {
        staleIssues.push(...(await client.paginate(client.rest.issues.listForRepo, {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            state: 'open',
            labels: args.staleIssueLabel,
            per_page: 100,
        })));
        core.debug(`found ${staleIssues.length} stale issues`);
    }
    else {
        core.debug('skipping stale issues due to empty message');
    }
    const stalePrs = [];
    if (args.stalePrMessage && args.stalePrMessage !== '') {
        stalePrs.push(...(await client.paginate(client.rest.issues.listForRepo, {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            state: 'open',
            labels: args.stalePrLabel,
            per_page: 100,
        })));
        core.debug(`found ${stalePrs.length} stale PRs`);
    }
    else {
        core.debug('skipping stale PRs due to empty message');
    }
    const ancientIssues = [];
    if (args.ancientIssueMessage && args.ancientIssueMessage !== '') {
        core.debug(`using issue ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} to determine for getting ancient issues.`);
        const ancientResults = await client.paginate(client.rest.issues.listForRepo, {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            state: 'open',
            per_page: 100,
            sort: 'updated',
            direction: 'asc',
        });
        ancientResults
            .filter((issue) => (args.useCreatedDateForAncient ? new Date(issue.created_at) : new Date(issue.updated_at)) <
            new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient))
            .map((i) => ancientIssues.push(i));
        core.debug(`found ${ancientIssues.length} ancient issues`);
    }
    else {
        core.debug('skipping ancient issues due to empty message');
    }
    const issues = [...responseIssues, ...staleIssues, ...stalePrs, ...ancientIssues];
    // Dedupe issues based on id
    const ids = new Set();
    return issues.filter((issue) => (ids.has(issue.id) ? false : ids.add(issue.id)));
}
async function hasEnoughUpvotes(client, issueNumber, upvoteCount) {
    const reactions = await client.paginate(client.rest.reactions.listForIssue, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issueNumber,
        // The squirrel-girl preview is no longer needed in newer versions
        per_page: 100,
    });
    const upvotes = reactions.filter((reaction) => reaction.content === '+1' ||
        reaction.content === 'heart' ||
        reaction.content === 'hooray' ||
        reaction.content === 'rocket').length;
    return upvotes >= upvoteCount;
}
//# sourceMappingURL=github.js.map