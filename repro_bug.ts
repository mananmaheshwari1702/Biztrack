
import { buildOrgTree } from './src/utils/treeUtils';
import { OrgNode, OrgLevel } from './src/types';
import * as fs from 'fs';

// Mock data: Root node and a child node with parentId: 'root'
const nodes: OrgNode[] = [
    {
        id: 'child1',
        name: 'Child User',
        role: 'Member',
        level: OrgLevel.Supervisor,
        parentId: 'root',
        children: []
    },
    {
        id: 'root',
        name: 'Root User',
        role: 'You',
        level: OrgLevel.Root,
        parentId: null,
        children: []
    }
];

let output = '';

output += "--- Testing with Child appearing BEFORE Root ---\n";
const tree1 = buildOrgTree(nodes);
output += `Root node Name: ${tree1?.name}\n`;
output += `Root node ID: ${tree1?.id}\n`;
output += `Children count: ${tree1?.children?.length}\n`;
if ((tree1?.children?.length ?? 0) > 0) {
    output += `First Child ID: ${tree1?.children[0].id}\n`;
}

const nodes2: OrgNode[] = [
    {
        id: 'root',
        name: 'Root User',
        role: 'You',
        level: OrgLevel.Root,
        parentId: null,
        children: []
    },
    {
        id: 'child1',
        name: 'Child User',
        role: 'Member',
        level: OrgLevel.Supervisor,
        parentId: 'root',
        children: []
    }
];

output += "\n--- Testing with Root appearing BEFORE Child ---\n";
const tree2 = buildOrgTree(nodes2);
output += `Root node Name: ${tree2?.name}\n`;
output += `Root node ID: ${tree2?.id}\n`;
output += `Children count: ${tree2?.children?.length}\n`;
if ((tree2?.children?.length ?? 0) > 0) {
    output += `First Child ID: ${tree2?.children[0].id}\n`;
}

console.log(output);
fs.writeFileSync('repro_output.txt', output);
