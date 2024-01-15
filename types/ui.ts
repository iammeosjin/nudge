import { TaskCycleSummary, TaskCycleSummaryType } from './common.ts';

export type WeeklySummaryPullRequesTableFooter = {
	weekNumber: number;
	totalPullRequestCreated: number;
	totalPullRequestReviewTime: number;
	totalPullRequestReviewed: number;
	totalTaskCycleAverageTime: number;
	totalTaskCycleSummary: Record<TaskCycleSummaryType, TaskCycleSummary>;
};
