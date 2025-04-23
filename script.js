// ==UserScript==
// @name         V2EX Used Code Striker++
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  在 V2EX 送码帖中，根据被评论区用户领取的激活码/邀请码，自动划掉主楼/附言中被提及的 Code。
// @author       与Gemini协作完成
// @match        https://www.v2ex.com/t/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=v2ex.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const STORAGE_KEY_KEYWORDS = 'v2ex_used_code_striker_keywords';
    const STORAGE_KEY_SHOW_USER = 'v2ex_used_code_striker_show_user';
    const defaultUsedKeywords = ['用', 'used', 'taken', '领', 'redeem', 'thx', '感谢'];

    // --- Load Settings ---
    const savedKeywordsString = GM_getValue(STORAGE_KEY_KEYWORDS, defaultUsedKeywords.join(','));
    const showUserInfoEnabled = GM_getValue(STORAGE_KEY_SHOW_USER, true); // Default to true (show user)

    let activeUsedKeywords = [];
    if (savedKeywordsString && savedKeywordsString.trim() !== '') {
        activeUsedKeywords = savedKeywordsString.split(',').map(kw => kw.trim()).filter(Boolean);
    }

    console.log('V2EX Used Code Striker: Active keywords:', activeUsedKeywords.length > 0 ? activeUsedKeywords : '(None - All comment codes considered used)');
    console.log('V2EX Used Code Striker: Show Username:', showUserInfoEnabled);

    // --- Regex & Style Setup ---
    const codeRegex = /(?:[A-Z0-9][-_]?){6,}/gi;
    const usedStyle = 'text-decoration: line-through; color: grey;';
    const userInfoStyle = 'font-size: smaller; margin-left: 5px; color: #999; text-decoration: none;'; // Style for the user link
    const markedClass = 'v2ex-used-code-marked'; // Class for the strikethrough span
    const userInfoClass = 'v2ex-code-claimant'; // Class for the user link anchor

    let keywordRegexCombinedTest = (text) => false; // Default test function

    // Build keyword regex only if there are active keywords
    if (activeUsedKeywords.length > 0) {
        const wordCharRegex = /^[a-zA-Z0-9_]+$/;
        const englishKeywords = activeUsedKeywords.filter(kw => wordCharRegex.test(kw));
        const nonWordBoundaryKeywords = activeUsedKeywords.filter(kw => !wordCharRegex.test(kw));
        const regexParts = [];

        if (englishKeywords.length > 0) {
            const englishPattern = `\\b(${englishKeywords.join('|')})\\b`;
            const englishRegex = new RegExp(englishPattern, 'i');
            regexParts.push((text) => englishRegex.test(text));
            // console.log("V2EX Used Code Striker: English Keyword Regex:", englishRegex);
        }

        if (nonWordBoundaryKeywords.length > 0) {
            const escapedNonWordKeywords = nonWordBoundaryKeywords.map(kw =>
                kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            );
            const nonWordPattern = `(${escapedNonWordKeywords.join('|')})`;
            const nonWordRegex = new RegExp(nonWordPattern, 'i');
            regexParts.push((text) => nonWordRegex.test(text));
            // console.log("V2EX Used Code Striker: Non-Word-Boundary Keyword Regex:", nonWordRegex);
        }

        if (regexParts.length > 0) {
            keywordRegexCombinedTest = (text) => {
                for (const testFn of regexParts) {
                    if (testFn(text)) return true;
                }
                return false;
            };
        }
    }

    // --- Menu Commands ---
    GM_registerMenuCommand('配置 V2EX 划掉 Code 关键词', () => {
        const currentKeywords = GM_getValue(STORAGE_KEY_KEYWORDS, defaultUsedKeywords.join(','));
        const newKeywordsString = prompt(
            '请输入评论中表示Code已使用的关键词，用英文逗号 (,) 分隔。\n\n' +
            '留空则表示评论中出现的所有Code都会被认为已使用。\n\n' +
            '当前配置:',
            currentKeywords
        );

        if (newKeywordsString !== null) { // Prompt wasn't cancelled
            const cleanedKeywords = newKeywordsString.trim();
            GM_setValue(STORAGE_KEY_KEYWORDS, cleanedKeywords);
            alert(
                '关键词已更新。\n' +
                `新配置: ${cleanedKeywords || '(空 - 所有评论Code都将被标记)'}\n\n` +
                '请刷新页面以应用更改。'
            );
        }
    });

    GM_registerMenuCommand(`切换显示/隐藏使用者信息 (${showUserInfoEnabled ? '当前: 显示' : '当前: 隐藏'})`, () => {
        const currentState = GM_getValue(STORAGE_KEY_SHOW_USER, true);
        const newState = !currentState;
        GM_setValue(STORAGE_KEY_SHOW_USER, newState);
        alert(
            `使用者信息显示已切换为: ${newState ? '显示' : '隐藏'}\n\n` +
            '请刷新页面以应用更改。'
        );
    });


    // --- Helper Function: findTextNodes (Unchanged) ---
    function findTextNodes(element, textNodes) {
        if (!element) return;
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.nodeValue.trim().length > 0) {
                    textNodes.push(node);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Avoid recursing into already marked spans or user links
                if (!(node.tagName === 'SPAN' && node.classList.contains(markedClass)) &&
                    !(node.tagName === 'A' && node.classList.contains(userInfoClass)))
                {
                   if (node.tagName !== 'A' && node.tagName !== 'CODE') { // Avoid recursing into normal links/code blocks? Check if needed.
                       findTextNodes(node, textNodes);
                   } else {
                       findTextNodes(node, textNodes); // Search inside A and CODE for text nodes too
                   }
                }
            }
        }
    }

    // --- Main Logic ---
    console.log('V2EX Used Code Striker: Script running...');

    // 1. Extract used Codes and Claimant Info from comments
    const claimedCodeInfo = new Map(); // Map<string, { username: string, profileUrl: string }>
    const commentElements = document.querySelectorAll('div.cell[id^="r_"]'); // Select the whole comment cell
    console.log(`V2EX Used Code Striker: Found ${commentElements.length} comment cells.`);

    const keywordsAreActive = activeUsedKeywords.length > 0;

    commentElements.forEach((commentCell, index) => {
        const replyContentEl = commentCell.querySelector('.reply_content');
        const userLinkEl = commentCell.querySelector('strong > a[href^="/member/"]');

        if (!replyContentEl || !userLinkEl) {
            // console.warn(`V2EX Used Code Striker: Skipping comment cell ${index + 1}, missing content or user link.`);
            return; // Skip if structure is unexpected
        }

        const commentText = replyContentEl.textContent;
        const username = userLinkEl.textContent;
        const profileUrl = userLinkEl.href;

        const potentialCodes = commentText.match(codeRegex);

        if (potentialCodes) {
            let commentMatchesCriteria = false;
            if (!keywordsAreActive) {
                // Setting is empty: consider all codes in comments as used
                commentMatchesCriteria = true;
            } else {
                // Keywords are defined: check if comment contains keywords
                if (keywordRegexCombinedTest(commentText)) {
                    commentMatchesCriteria = true;
                }
            }

            if (commentMatchesCriteria) {
                potentialCodes.forEach(code => {
                    const codeUpper = code.toUpperCase();
                    // Only store the *first* user claiming a specific code
                    if (!claimedCodeInfo.has(codeUpper)) {
                        console.log(`V2EX Used Code Striker: Found potential used code "${code}" by user "${username}" in comment ${index + 1}`);
                        claimedCodeInfo.set(codeUpper, { username, profileUrl });
                    }
                });
            }
        }
    });

    console.log(`V2EX Used Code Striker: Extracted info for ${claimedCodeInfo.size} unique potential used codes based on config:`, claimedCodeInfo);

    if (claimedCodeInfo.size === 0) {
        console.log('V2EX Used Code Striker: No potential used codes found in comments matching criteria. Exiting.');
        return;
    }

    // 2. Find and mark Codes in main post and supplements
    const contentAreas = [
        document.querySelector('.topic_content'),          // Main post content
        ...document.querySelectorAll('.subtle .topic_content') // Supplement content (inside .markdown_body)
    ].filter(el => el); // Filter out nulls if no supplements

    console.log(`V2EX Used Code Striker: Found ${contentAreas.length} content areas to scan.`);

    contentAreas.forEach((area, areaIndex) => {
        const textNodes = [];
        findTextNodes(area, textNodes);

        textNodes.forEach(node => {
            // Check if the node is already inside a marked element (double check)
            if (node.parentNode && (node.parentNode.classList.contains(markedClass) || node.parentNode.classList.contains(userInfoClass))) {
                return;
            }

            const nodeText = node.nodeValue;
            let match;
            let lastIndex = 0;
            const newNodeContainer = document.createDocumentFragment();
            const regex = new RegExp(codeRegex.source, 'gi'); // Create new regex instance for each node
            regex.lastIndex = 0; // Reset lastIndex

            while ((match = regex.exec(nodeText)) !== null) {
                const matchedCode = match[0];
                const matchedCodeUpper = matchedCode.toUpperCase();

                if (claimedCodeInfo.has(matchedCodeUpper)) {
                    const claimInfo = claimedCodeInfo.get(matchedCodeUpper);

                    // Add text before the match
                    if (match.index > lastIndex) {
                        newNodeContainer.appendChild(document.createTextNode(nodeText.substring(lastIndex, match.index)));
                    }

                    // Create the strikethrough span for the code
                    const span = document.createElement('span');
                    span.textContent = matchedCode;
                    span.style.cssText = usedStyle;
                    span.title = `Code "${matchedCode}" likely used by ${claimInfo.username}`;
                    span.classList.add(markedClass);
                    newNodeContainer.appendChild(span);

                    // Optionally, add the user info link
                    if (showUserInfoEnabled && claimInfo) {
                        const userLink = document.createElement('a');
                        userLink.href = claimInfo.profileUrl;
                        userLink.textContent = ` (@${claimInfo.username})`;
                        userLink.style.cssText = userInfoStyle;
                        userLink.classList.add(userInfoClass);
                        userLink.target = '_blank'; // Open in new tab
                        userLink.title = `View profile of ${claimInfo.username}`;
                        newNodeContainer.appendChild(userLink);
                    }

                    lastIndex = regex.lastIndex;

                } else {
                   // If code is not in the claimed map, ensure loop continues correctly.
                   // regex.lastIndex is automatically advanced by exec().
                }
            }

            // Add any remaining text after the last match (or the whole text if no matches)
            if (lastIndex < nodeText.length) {
                newNodeContainer.appendChild(document.createTextNode(nodeText.substring(lastIndex)));
            }

            // Replace the original text node only if modifications were made
            if (newNodeContainer.hasChildNodes() && lastIndex > 0) { // lastIndex > 0 implies at least one match was processed
                node.parentNode.replaceChild(newNodeContainer, node);
            }
        });
    });

    console.log('V2EX Used Code Striker: Script finished.');

})();