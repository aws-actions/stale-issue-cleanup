/* eslint-disable prettier/prettier */
const nock = require('nock');

require('dotenv').config({
  path: require('path').resolve(__dirname, '.env.test'),
});

const { run, getAndValidateInputs } = require('../src/entrypoint.js');
const { revCompareEventsByDate } = require('../src/utils.js');

describe('GitHub issue parser', () => {
  const OLD_ENV = process.env;
  const now = '2019-12-31T00:00:00.000Z';
  let mockDate;

  beforeEach(() => {
    jest.resetModules();
    mockDate = jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date(now));
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    mockDate.mockRestore();
    if (!nock.isDone()) {
      nock.cleanAll();
    }
  });

  test('reads env vars', () => {
    expect(getAndValidateInputs()).toEqual({
      repoToken: process.env.REPO_TOKEN,
      ancientIssueMessage: process.env.ANCIENT_ISSUE_MESSAGE,
      ancientPrMessage: process.env.ANCIENT_PR_MESSAGE,
      dryrun: !!process.env.DRYRUN,
      staleIssueMessage: process.env.STALE_ISSUE_MESSAGE,
      stalePrMessage: process.env.STALE_PR_MESSAGE,
      daysBeforeStale: parseFloat(process.env.DAYS_BEFORE_STALE),
      daysBeforeClose: parseFloat(process.env.DAYS_BEFORE_CLOSE),
      daysBeforeAncient: parseFloat(process.env.DAYS_BEFORE_ANCIENT),
      staleIssueLabel: process.env.STALE_ISSUE_LABEL,
      exemptIssueLabel: process.env.EXEMPT_ISSUE_LABEL,
      stalePrLabel: process.env.STALE_PR_LABEL,
      exemptPrLabel: process.env.EXEMPT_PR_LABEL,
      responseRequestedLabel: process.env.RESPONSE_REQUESTED_LABEL,
      minimumUpvotesToExempt: parseInt(process.env.MINIMUM_UPVOTES_TO_EXEMPT),
    });
  });

  test('handles bogus inputs', () => {
    process.env.DAYS_BEFORE_ANCIENT = 'asdf';
    expect(() => {
      getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_ANCIENT = OLD_ENV.DAYS_EFORE_ANCIENT;
    process.env.DAYS_BEFORE_STALE = 'asdf';
    expect(() => {
      getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_STALE = OLD_ENV.DAYS_BEFORE_STALE;
    process.env.DAYS_BEFORE_CLOSE = 'asdf';
    expect(() => {
      getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_CLOSE = OLD_ENV.DAYS_BEFORE_CLOSE;
  });

  test('compares dates in reverse', () => {
    const dateA = '2018-12-31T00:00:00.000Z';
    const dateB = now;
    const eventA = { created_at: dateA };
    const eventB = { created_at: dateB };
    expect(revCompareEventsByDate(eventA, eventB)).toBe(1);
    expect(revCompareEventsByDate(eventB, eventA)).toBe(-1);
  });

  test('skips issue with empty messages', async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, []);
    process.env.ANCIENT_ISSUE_MESSAGE = '';
    process.env.STALE_ISSUE_MESSAGE = '';
    process.env.STALE_PR_MESSAGE = '';
    await run();
    process.env.STALE_ISSUE_MESSAGE = process.env.STALE_ISSUE_MESSAGE;
    process.env.ANCIENT_ISSUE_MESSAGE = OLD_ENV.ANCIENT_ISSUE_MESSAGE;
    process.env.STALE_PR_MESSAGE = OLD_ENV.STALE_PR_LABEL;
  });

  test('consumes the GitHub API', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/256",id:172115562,node_id:"MDU6SXNzdWUxNzIxMTU1NjI=",number:256,title:"Exempt",labels:[{id:600797884,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/go-away-bot",name:"go-away-bot"}],state:"open",comments:0,created_at:"2016-08-19T11:57:17Z",updated_at:"2017-05-08T21:20:09Z",closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null},{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/257",id:172115557,node_id:"MDU6SXNzdWUx7zIxMTU1NjI=",number:257,title:"Stale but commented",labels:[{id:600797884,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/response-requested",name:"response-requested"},{id:600797885,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/closing-soon",name:"closing-soon"}],state:"open",comments:1,created_at:"2016-08-19T11:57:17Z",updated_at:now,closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null},{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/261",id:172115561,node_id:"MDU6SXNzd6Ux7zIxMTU1NjI=",number:261,title:"Mark me stale",labels:[{id:600797884,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/response-requested",name:"response-requested"}],state:"open",comments:1,created_at:new Date(Date.parse(now)-864e5*process.env.DAYS_BEFORE_STALE).toISOString(),updated_at:new Date(Date.parse(now)-864e5*process.env.DAYS_BEFORE_STALE).toISOString(),closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null},{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/262",id:179915562,node_id:"MDU62XNzd6Ux7zIxMTU1NjI=",number:262,title:"Comments happened",labels:[{id:600797884,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/response-requested",name:"response-requested"}],state:"open",comments:1,created_at:"2016-08-19T11:57:17Z",updated_at:now,closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null},{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/263",id:179916362,node_id:"MDU62X63d6Ux7zIxMTU1NjI=",number:263,title:"Keep me open",labels:[{id:600797884,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/response-requested",name:"response-requested"}],state:"open",comments:0,created_at:"2016-08-19T11:57:17Z",updated_at:now,closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.STALE_ISSUE_LABEL,
        per_page: 100,
      })
      .reply(200, [{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/257",id:172115557,node_id:"MDU6SXNzdWUx7zIxMTU1NjI=",number:257,title:"Stale but commented",labels:[{id:600797884,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/response-requested",name:"response-requested"},{id:600797885,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/closing-soon",name:"closing-soon"}],state:"open",comments:1,created_at:"2016-08-19T11:57:17Z",updated_at:now,closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null},{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/258",id:172115587,node_id:"MD86SXNzdWUx7zIxMTU1NjI=",number:258,title:"Stale and close",labels:[{id:600797885,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/closing-soon",name:"closing-soon"}],state:"open",comments:0,created_at:"2016-08-19T11:57:17Z",updated_at:"2016-08-19T12:48:44Z",closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null},{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/259",id:172115559,node_id:"MD86SXNzdWUx759xMTU1NjI=",number:259,title:"Stale no close",labels:[{id:600797885,node_id:"MDU6TGFiZWw2MDA3OTc4ODQ=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/labels/closing-soon",name:"closing-soon"}],state:"open",comments:0,created_at:"2016-08-19T11:57:17Z",updated_at:now,closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.STALE_PR_LABEL,
        per_page: 100,
      })
      .reply(200, [])

      .delete(
        '/repos/aws-actions/stale-issue-cleanup/issues/257/labels/closing-soon'
      )
      .reply(204, {})

      .delete(
        '/repos/aws-actions/stale-issue-cleanup/issues/257/labels/response-requested'
      )
      .reply(204, {})

      .delete(
        '/repos/aws-actions/stale-issue-cleanup/issues/258/labels/closing-soon'
      )
      .reply(204, {})

      .patch('/repos/aws-actions/stale-issue-cleanup/issues/258')
      .reply(200, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/comments', {
        body: 'Stale issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/299/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/299/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {})

      .delete(
        '/repos/aws-actions/stale-issue-cleanup/issues/262/labels/response-requested'
      )
      .reply(204, {})

      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, [{id:1073560592,node_id:"MDEyOpxhvmVsZWRFdmVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560592",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",type:"User",site_admin:!1},event:"labeled",commit_id:null,commit_url:null,created_at:"2016-08-19T11:57:18Z",label:{name:"go-away-bot",color:"c5def5"}}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/257/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200,[{id:1073560592,node_id:"MDEyOpxhvmVsZWRFdmVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560592",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",type:"User",site_admin:!1},event:"labeled",commit_id:null,commit_url:null,created_at:"2016-08-19T11:57:18Z",label:{name:"closing-soon",color:"c5def5"}},{id:1073560792,node_id:"MDEyOpxhYmVsZWRFdpVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560792",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",avatar_url:"https://avatars3.githubusercontent.com/u/583231?v=4",gravatar_id:"",url:"https://api.github.com/users/octocat",html_url:"https://github.com/octocat",followers_url:"https://api.github.com/users/octocat/followers",following_url:"https://api.github.com/users/octocat/following{/other_user}",gists_url:"https://api.github.com/users/octocat/gists{/gist_id}",starred_url:"https://api.github.com/users/octocat/starred{/owner}{/repo}",subscriptions_url:"https://api.github.com/users/octocat/subscriptions",organizations_url:"https://api.github.com/users/octocat/orgs",repos_url:"https://api.github.com/users/octocat/repos",events_url:"https://api.github.com/users/octocat/events{/privacy}",received_events_url:"https://api.github.com/users/octocat/received_events",type:"User",site_admin:!1},event:"commented",commit_id:null,commit_url:null,created_at:now}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/258/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200,[{id:1073560592,node_id:"MDEyOpxhvmVsZWRFdmVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560592",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",type:"User",site_admin:!1},event:"labeled",commit_id:null,commit_url:null,created_at:"2016-08-19T12:48:44Z",label:{name:"closing-soon",color:"c5def5"}}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/259/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200,[{id:1073560592,node_id:"MDEyOpxhvmVsZWRFdmVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560592",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",type:"User",site_admin:!1},event:"labeled",commit_id:null,commit_url:null,created_at:now,label:{name:"closing-soon",color:"c5def5"}}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/261/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200,[{id:1073560592,node_id:"MDEyOpxhvmVsZWRFdmVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560592",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",type:"User",site_admin:!1},event:"labeled",commit_id:null,commit_url:null,created_at:new Date(Date.parse(now)-864e5*process.env.DAYS_BEFORE_STALE).toISOString(),label:{name:"response-requested",color:"c5def5"}}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/262/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200,[{id:1073560592,node_id:"MDEyOpxhvmVsZWRFdmVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560592",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",type:"User",site_admin:!1},event:"labeled",commit_id:null,commit_url:null,created_at:"2016-08-19T11:57:18Z",label:{name:"response-requested",color:"c5def5"}},{id:1073560792,node_id:"MDEyOpxhYmVsZWRFdpVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560792",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",avatar_url:"https://avatars3.githubusercontent.com/u/583231?v=4",gravatar_id:"",url:"https://api.github.com/users/octocat",html_url:"https://github.com/octocat",followers_url:"https://api.github.com/users/octocat/followers",following_url:"https://api.github.com/users/octocat/following{/other_user}",gists_url:"https://api.github.com/users/octocat/gists{/gist_id}",starred_url:"https://api.github.com/users/octocat/starred{/owner}{/repo}",subscriptions_url:"https://api.github.com/users/octocat/subscriptions",organizations_url:"https://api.github.com/users/octocat/orgs",repos_url:"https://api.github.com/users/octocat/repos",events_url:"https://api.github.com/users/octocat/events{/privacy}",received_events_url:"https://api.github.com/users/octocat/received_events",type:"User",site_admin:!1},event:"commented",commit_id:null,commit_url:null,created_at:now}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/263/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200,[{id:1073560592,node_id:"MDEyOpxhvmVsZWRFdmVudDEwNzM1NjA1OTE=",url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/events/1073560592",actor:{login:"octocat",id:583231,node_id:"MDQ6VXNlcjU4MzIzMQ==",type:"User",site_admin:!1},event:"labeled",commit_id:null,commit_url:null,created_at:now,label:{name:"response-requested",color:"c5def5"}}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/299/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        sort: 'updated',
        direction: 'asc',
        per_page: 100,
      })
      .reply(200,[{url:"https://api.github.com/repos/aws-actions/stale-issue-cleanup/issues/299",id:172115599,node_id:"MDU6SXNzdWUxNzIx9TU1NjI=",number:299,title:"Ancient",state:"open",comments:0,created_at:"2016-08-19T11:57:17Z",updated_at:"2017-05-08T21:20:09Z",closed_at:"2016-08-19T12:48:43Z",author_association:"NONE",body:null}])

      .get('/repos/aws-actions/stale-issue-cleanup/issues/299/reactions')
      .query({ per_page: 100 })
      .reply(200, []);

    await run();

    expect(scope.isDone()).toEqual(true);
  });
});
