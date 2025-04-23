// ==UserScript==
// @name         V2EX Used Code Striker++
// @namespace    http://tampermonkey.net/
// @version      1.4.2
// @description  在 V2EX 送码帖中，根据评论和配置，自动划掉主楼/附言中被提及的 Code，并可选显示领取者。通过设置界面配置。
// @author       与Gemini协作完成 (Based on iblogc's work)
// @match        https://www.v2ex.com/t/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=v2ex.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Storage Keys ---
    const STORAGE_KEY_TITLE_KEYWORDS = 'v2ex_striker_title_keywords';
    const STORAGE_KEY_COMMENT_KEYWORDS = 'v2ex_striker_comment_keywords';
    const STORAGE_KEY_SHOW_USER = 'v2ex_striker_show_user';
    const MODAL_ID = 'v2ex-striker-settings-modal';
    const OVERLAY_ID = 'v2ex-striker-settings-overlay';

    // --- Default Settings ---
    const defaultTitleKeywords = ['送', '发', '福利', '邀请码', '激活码', '码', 'giveaway', 'invite', 'code'];
    const defaultCommentKeywords = ['用', 'used', 'taken', '领', 'redeem', 'thx', '感谢'];
    const defaultShowUserInfo = true;

    // --- Load Settings ---
    const titleKeywordsString = GM_getValue(STORAGE_KEY_TITLE_KEYWORDS, defaultTitleKeywords.join(','));
    const commentKeywordsString = GM_getValue(STORAGE_KEY_COMMENT_KEYWORDS, defaultCommentKeywords.join(','));
    const showUserInfoEnabled = GM_getValue(STORAGE_KEY_SHOW_USER, defaultShowUserInfo);

    let activeTitleKeywords = [];
    if (titleKeywordsString && titleKeywordsString.trim() !== '') {
        activeTitleKeywords = titleKeywordsString.split(',').map(kw => kw.trim().toLowerCase()).filter(Boolean);
    }

    let activeCommentKeywords = [];
    if (commentKeywordsString && commentKeywordsString.trim() !== '') {
        activeCommentKeywords = commentKeywordsString.split(',').map(kw => kw.trim()).filter(Boolean);
    }

    // --- Settings Modal Functions (Define early) ---
    function buildSettingsModal() {
        // (Modal building code remains the same as previous version)
        // Remove existing modal if any
        document.getElementById(MODAL_ID)?.remove();
        document.getElementById(OVERLAY_ID)?.remove();

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.onclick = closeSettingsModal;

        // Modal Container
        const modal = document.createElement('div');
        modal.id = MODAL_ID;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'V2EX Used Code Striker 设置';
        modal.appendChild(title);

        // 1. Title Keywords
        const titleDiv = document.createElement('div');
        titleDiv.className = 'setting-item';
        const titleLabel = document.createElement('label');
        titleLabel.textContent = '帖子标题关键词 (英文逗号分隔):';
        titleLabel.htmlFor = 'v2ex-striker-title-keywords-input';
        const titleInput = document.createElement('textarea');
        titleInput.id = 'v2ex-striker-title-keywords-input';
        titleInput.value = GM_getValue(STORAGE_KEY_TITLE_KEYWORDS, defaultTitleKeywords.join(','));
        titleInput.rows = 2;
        titleDiv.appendChild(titleLabel);
        titleDiv.appendChild(titleInput);
        modal.appendChild(titleDiv);
        const titleDesc = document.createElement('p');
        titleDesc.className = 'setting-desc';
        titleDesc.textContent = '包含这些词的帖子标题才会激活脚本。留空则不根据标题判断（不推荐）。';
        modal.appendChild(titleDesc);

        // 2. Comment Keywords
        const commentDiv = document.createElement('div');
        commentDiv.className = 'setting-item';
        const commentLabel = document.createElement('label');
        commentLabel.textContent = '评论区关键词 (英文逗号分隔):';
        commentLabel.htmlFor = 'v2ex-striker-comment-keywords-input';
        const commentInput = document.createElement('textarea');
        commentInput.id = 'v2ex-striker-comment-keywords-input';
        commentInput.value = GM_getValue(STORAGE_KEY_COMMENT_KEYWORDS, defaultCommentKeywords.join(','));
        commentInput.rows = 3;
        commentDiv.appendChild(commentLabel);
        commentDiv.appendChild(commentInput);
        modal.appendChild(commentDiv);
        const commentDesc = document.createElement('p');
        commentDesc.className = 'setting-desc';
        commentDesc.textContent = '评论需包含这些词才会标记对应 Code。留空则评论中所有 Code 都被标记。';
        modal.appendChild(commentDesc);

        // 3. Show User Info
        const showUserDiv = document.createElement('div');
        showUserDiv.className = 'setting-item setting-item-checkbox';
        const showUserInput = document.createElement('input');
        showUserInput.type = 'checkbox';
        showUserInput.id = 'v2ex-striker-show-user-input';
        showUserInput.checked = GM_getValue(STORAGE_KEY_SHOW_USER, defaultShowUserInfo);
        const showUserLabel = document.createElement('label');
        showUserLabel.textContent = '在划掉的 Code 旁显示使用者信息';
        showUserLabel.htmlFor = 'v2ex-striker-show-user-input';
        showUserDiv.appendChild(showUserInput);
        showUserDiv.appendChild(showUserLabel);
        modal.appendChild(showUserDiv);

        // Action Buttons
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'setting-actions';
        const saveButton = document.createElement('button');
        saveButton.textContent = '保存设置';
        saveButton.onclick = saveSettings;
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.className = 'cancel-button';
        cancelButton.onclick = closeSettingsModal;
        buttonDiv.appendChild(cancelButton);
        buttonDiv.appendChild(saveButton);
        modal.appendChild(buttonDiv);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    function closeSettingsModal() {
        document.getElementById(MODAL_ID)?.remove();
        document.getElementById(OVERLAY_ID)?.remove();
    }

    function saveSettings() {
        const titleKeywords = document.getElementById('v2ex-striker-title-keywords-input').value.trim();
        const commentKeywords = document.getElementById('v2ex-striker-comment-keywords-input').value.trim();
        const showUser = document.getElementById('v2ex-striker-show-user-input').checked;

        GM_setValue(STORAGE_KEY_TITLE_KEYWORDS, titleKeywords);
        GM_setValue(STORAGE_KEY_COMMENT_KEYWORDS, commentKeywords);
        GM_setValue(STORAGE_KEY_SHOW_USER, showUser);

        closeSettingsModal();
        alert('设置已保存！\n请刷新页面以应用新的设置。');
    }

    // --- Add Modal Styles (Always add styles) ---
    GM_addStyle(`
        #${OVERLAY_ID} { /* Styles remain the same */
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.4); z-index: 9998; backdrop-filter: blur(3px);
        }
        #${MODAL_ID} { /* Styles remain the same */
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 90%; max-width: 500px; background-color: #f9f9f9; border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.15); padding: 25px 30px; z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            color: #333; box-sizing: border-box;
        }
        #${MODAL_ID} h2 { margin-top: 0; margin-bottom: 25px; font-size: 1.4em; font-weight: 600; text-align: center; color: #1d1d1f; }
        #${MODAL_ID} .setting-item { margin-bottom: 10px; }
        #${MODAL_ID} .setting-desc { font-size: 0.8em; color: #6e6e73; margin-top: 0px; margin-bottom: 15px; }
        #${MODAL_ID} label { display: block; margin-bottom: 5px; font-weight: 500; font-size: 0.95em; color: #333; }
        #${MODAL_ID} textarea {
            width: 100%; padding: 10px; border: 1px solid #d2d2d7; border-radius: 6px;
            font-size: 0.9em; box-sizing: border-box; resize: vertical; min-height: 40px; font-family: inherit;
        }
        #${MODAL_ID} textarea:focus { border-color: #007aff; outline: none; box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2); }
        #${MODAL_ID} .setting-item-checkbox { display: flex; align-items: center; margin-top: 20px; margin-bottom: 25px; }
        #${MODAL_ID} .setting-item-checkbox input[type="checkbox"] { margin-right: 10px; width: 16px; height: 16px; accent-color: #007aff; }
        #${MODAL_ID} .setting-item-checkbox label { margin-bottom: 0; font-weight: normal; }
        #${MODAL_ID} .setting-actions { margin-top: 25px; display: flex; justify-content: flex-end; gap: 10px; }
        #${MODAL_ID} button { padding: 10px 20px; border: none; border-radius: 6px; font-size: 0.95em; font-weight: 500; cursor: pointer; transition: background-color 0.2s ease; }
        #${MODAL_ID} button:last-child { background-color: #007aff; color: white; }
        #${MODAL_ID} button:last-child:hover { background-color: #005ecf; }
        #${MODAL_ID} button.cancel-button { background-color: #e5e5ea; color: #1d1d1f; }
        #${MODAL_ID} button.cancel-button:hover { background-color: #dcdce0; }
    `);

    // --- Menu Command Registration (Always register) ---
    function registerSettingsMenu() {
        GM_registerMenuCommand('⚙️ V2EX Striker 设置', buildSettingsModal);
    }
    registerSettingsMenu();

    // --- Initial Title Check ---
    const postTitle = document.title.toLowerCase();
    let isGiveawayPost = false;
    if (activeTitleKeywords.length > 0) {
        isGiveawayPost = activeTitleKeywords.some(keyword => postTitle.includes(keyword));
    } else {
        console.log('V2EX Striker: Title keyword list is empty, skipping title check (not recommended).');
        // If title keywords are empty, maybe run the script anyway? Or force user to add keywords?
        // For now, let's assume empty means run always (though the UI description discourages it).
        isGiveawayPost = true; // Or set to false if empty list should disable the script.
    }

    if (!isGiveawayPost) {
        console.log('V2EX Striker: Post title does not match configured keywords. Script inactive for marking codes on this page.');
        return; // Stop script execution for marking codes
    }

    // --- IF TITLE CHECK PASSES, CONTINUE WITH THE REST OF THE LOGIC ---

    console.log('V2EX Striker: Post title matched. Running main script logic...');

    // --- Regex, Styles, Classes (Define constants used below) ---
    const codeRegex = /(?:[A-Z0-9][-_]?){6,}/gi;
    const usedStyle = 'text-decoration: line-through; color: grey;';
    const userInfoStyle = 'font-size: smaller; margin-left: 5px; color: #999; text-decoration: none;';
    const markedClass = 'v2ex-used-code-marked';
    const userInfoClass = 'v2ex-code-claimant';

    // --- Keyword Regex Building (Comment Keywords) ---
    let keywordRegexCombinedTest = (text) => false; // Default test function
    if (activeCommentKeywords.length > 0) {
        // (Keyword regex building code remains the same)
        const wordCharRegex = /^[a-zA-Z0-9_]+$/;
        const englishKeywords = activeCommentKeywords.filter(kw => wordCharRegex.test(kw));
        const nonWordBoundaryKeywords = activeCommentKeywords.filter(kw => !wordCharRegex.test(kw));
        const regexParts = [];

        if (englishKeywords.length > 0) {
            const englishPattern = `\\b(${englishKeywords.join('|')})\\b`;
            const englishRegex = new RegExp(englishPattern, 'i');
            regexParts.push((text) => englishRegex.test(text));
        }
        if (nonWordBoundaryKeywords.length > 0) {
            const escapedNonWordKeywords = nonWordBoundaryKeywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const nonWordPattern = `(${escapedNonWordKeywords.join('|')})`;
            const nonWordRegex = new RegExp(nonWordPattern, 'i');
            regexParts.push((text) => nonWordRegex.test(text));
        }
        if (regexParts.length > 0) {
            keywordRegexCombinedTest = (text) => regexParts.some(testFn => testFn(text));
        }
    }


    // --- Helper Function: findTextNodes (Unchanged) ---
    function findTextNodes(element, textNodes) {
        // (findTextNodes code remains the same)
        if (!element) return;
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.nodeValue.trim().length > 0) {
                    textNodes.push(node);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (!(node.tagName === 'SPAN' && node.classList.contains(markedClass)) &&
                    !(node.tagName === 'A' && node.classList.contains(userInfoClass)))
                {
                   if (node.tagName !== 'A' && node.tagName !== 'CODE') {
                       findTextNodes(node, textNodes);
                   } else {
                       findTextNodes(node, textNodes);
                   }
                }
            }
        }
    }

    // --- Main Logic (Extraction and Marking - Adapted from v1.3) ---
    console.log('V2EX Striker: Starting code extraction and marking...');

    // 1. Extract used Codes and Claimant Info from comments
    const claimedCodeInfo = new Map();
    const commentElements = document.querySelectorAll('div.cell[id^="r_"]');
    console.log(`V2EX Striker: Found ${commentElements.length} comment cells.`);

    const commentKeywordsAreActive = activeCommentKeywords.length > 0;

    commentElements.forEach((commentCell, index) => {
        // (Comment processing logic remains the same)
        const replyContentEl = commentCell.querySelector('.reply_content');
        const userLinkEl = commentCell.querySelector('strong > a[href^="/member/"]');
        if (!replyContentEl || !userLinkEl) return;

        const commentText = replyContentEl.textContent;
        const username = userLinkEl.textContent;
        const profileUrl = userLinkEl.href;
        const potentialCodes = commentText.match(codeRegex);

        if (potentialCodes) {
            let commentMatchesCriteria = false;
            if (!commentKeywordsAreActive) {
                commentMatchesCriteria = true;
            } else if (keywordRegexCombinedTest(commentText)) {
                commentMatchesCriteria = true;
            }

            if (commentMatchesCriteria) {
                potentialCodes.forEach(code => {
                    const codeUpper = code.toUpperCase();
                    if (!claimedCodeInfo.has(codeUpper)) {
                        // console.log(`V2EX Striker: Found potential used code "${code}" by user "${username}" in comment ${index + 1}`);
                        claimedCodeInfo.set(codeUpper, { username, profileUrl });
                    }
                });
            }
        }
    });

    console.log(`V2EX Striker: Extracted info for ${claimedCodeInfo.size} unique potential used codes based on config:`, claimedCodeInfo.size > 0 ? [...claimedCodeInfo.keys()] : 'None'); // Log keys for less clutter

    if (claimedCodeInfo.size === 0) {
        console.log('V2EX Striker: No potential used codes found in comments matching criteria. Exiting marking phase.');
        return;
    }

    // 2. Find and mark Codes in main post and supplements
    const contentAreas = [
        document.querySelector('.topic_content'),
        ...document.querySelectorAll('.subtle .topic_content')
    ].filter(Boolean);

    console.log(`V2EX Striker: Found ${contentAreas.length} content areas to scan for marking.`);

    contentAreas.forEach((area) => {
        // (Marking logic remains the same)
        const textNodes = [];
        findTextNodes(area, textNodes);

        textNodes.forEach(node => {
            if (node.parentNode && (node.parentNode.classList.contains(markedClass) || node.parentNode.classList.contains(userInfoClass))) {
                return;
            }

            const nodeText = node.nodeValue;
            let match;
            let lastIndex = 0;
            const newNodeContainer = document.createDocumentFragment();
            const regex = new RegExp(codeRegex.source, 'gi');
            regex.lastIndex = 0;

            while ((match = regex.exec(nodeText)) !== null) {
                const matchedCode = match[0];
                const matchedCodeUpper = matchedCode.toUpperCase();

                if (claimedCodeInfo.has(matchedCodeUpper)) {
                    const claimInfo = claimedCodeInfo.get(matchedCodeUpper);
                    if (match.index > lastIndex) {
                        newNodeContainer.appendChild(document.createTextNode(nodeText.substring(lastIndex, match.index)));
                    }
                    const span = document.createElement('span');
                    span.textContent = matchedCode;
                    span.style.cssText = usedStyle;
                    span.title = `Code "${matchedCode}" likely used by ${claimInfo.username}`;
                    span.classList.add(markedClass);
                    newNodeContainer.appendChild(span);

                    if (showUserInfoEnabled && claimInfo) {
                        const userLink = document.createElement('a');
                        userLink.href = claimInfo.profileUrl;
                        userLink.textContent = ` (@${claimInfo.username})`;
                        userLink.style.cssText = userInfoStyle;
                        userLink.classList.add(userInfoClass);
                        userLink.target = '_blank';
                        userLink.title = `View profile of ${claimInfo.username}`;
                        newNodeContainer.appendChild(userLink);
                    }
                    lastIndex = regex.lastIndex;
                }
            }

            if (lastIndex < nodeText.length) {
                newNodeContainer.appendChild(document.createTextNode(nodeText.substring(lastIndex)));
            }

            if (newNodeContainer.hasChildNodes() && lastIndex > 0) {
                node.parentNode.replaceChild(newNodeContainer, node);
            }
        });
    });

    console.log('V2EX Striker: Script finished.');

})();