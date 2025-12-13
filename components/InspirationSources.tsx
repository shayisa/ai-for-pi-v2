import React, { useState } from 'react';
import { BookOpenIcon, ChevronDownIcon, LinkIcon } from './IconComponents';

const sources = {
    "General AI News & Trend Sites": [
        { title: "AI News", url: "https://www.artificialintelligence-news.com" },
        { title: "AI Magazine", url: "https://aimagazine.com" },
        { title: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/" },
    ],
    "Leading AI Newsletters": [
        { title: "Superhuman AI Newsletter", url: "https://www.superhuman.ai" },
        { title: "Zapier’s Best AI Newsletters", url: "https://zapier.com/blog/best-ai-newsletters/" },
        { title: "Exploding Topics AI Newsletters", url: "https://explodingtopics.com/blog/ai-newsletters" },
    ],
    "Research & Academic AI Resources": [
        { title: "OpenAI Blog", url: "https://openai.com/blog/" },
        { title: "Google DeepMind Blog", url: "https://deepmind.google/discover/blog/" },
        { title: "Anthropology News AI Issue", url: "https://www.anthropology-news.org/issue/artificial-intelligence/" },
    ],
    "Forensic & Domain-Specific Applications": [
        { title: "MSU Forensic Anthropologists Use AI", url: "https://msutoday.msu.edu/news/2025/04/msu-forensic-anthropologists-use-ai-to-enhance-and-accelerate-human-identification" },
        { title: "CSIRO AI Forensic Tool", url: "https://www.csiro.au/en/news/all/news/2025/february/csiro-develops-ai-tool-for-rapid-identification-in-forensic-investigations" },
        { title: "Science News Forensic AI Article", "url": "https://www.sciencenews.org/article/ai-violent-crime-forensics-blowflies" },
    ],
    "AI Tools & Business Analytics Resources": [
        { title: "AI Acquisition – Best AI Tools", url: "https://www.aiacquisition.com/blog/best-ai-tools-for-business-analyst" },
        { title: "Synthesia – Best AI Tools in 2025", url: "https://www.synthesia.io/post/ai-tools" },
        { title: "Pluralsight – 15 AI Tools", url: "https://www.pluralsight.com/resources/blog/ai-and-data/15-business-analytics-ai-tools" },
    ],
    "Digital/Computational Archaeology & AI": [
        { title: "Investigating AI in Archaeology (COST.eu)", url: "https://www.cost.eu/investigating-ai-in-archaeology-with-maia/" },
        { title: "Griffith News – AI to Identify Ancient Artists", url: "https://news.griffith.edu.au/2025/10/17/training-ai-to-identify-ancient-artists/" },
        { title: "ACM Communications – Archaeologists Using AI", url: "https://cacm.acm.org/news/archeologists-dig-deep-into-the-past-with-ai/" },
    ],
};


export const InspirationSources: React.FC = () => {

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-border-light p-6 md:p-8">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-muted-blue mb-4 flex items-center gap-2">
                <BookOpenIcon className="h-6 w-6" />
                AI Inspiration Sources
            </h2>
            <p className="text-secondary-text mb-6">These high-quality sources guide the AI's web search for relevant topics and information.</p>
            <div id="inspiration-sources-content">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(sources).map(([category, links]) => (
                        <div key={category}>
                            <h3 className="font-semibold text-primary-text mb-3">{category}</h3>
                            <ul className="space-y-2">
                                {links.map((link) => (
                                    <li key={link.url}>
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-2 text-sm text-secondary-text hover:text-accent-muted-blue transition-colors group"
                                        >
                                            <LinkIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500 group-hover:text-accent-muted-blue"/>
                                            <span>{link.title}</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};