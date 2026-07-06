// Starter diagrams for the template picker.

export interface Template {
  id: string;
  label: string;
  code: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "flowchart",
    label: "Flowchart",
    code: `flowchart TD
    A([Start]) --> B{Is it working?}
    B -->|Yes| C[Ship it 🚀]
    B -->|No| D[Debug]
    D --> E[/Read the logs/]
    E --> B
    C --> F([Done])`,
  },
  {
    id: "sequence",
    label: "Sequence",
    code: `sequenceDiagram
    autonumber
    participant U as User
    participant A as App
    participant S as Server
    U->>A: Click "Save"
    A->>S: POST /save
    S-->>A: 200 OK
    A-->>U: Saved ✔
    Note over U,S: Round trip complete`,
  },
  {
    id: "class",
    label: "Class",
    code: `classDiagram
    class Animal {
      +String name
      +int age
      +makeSound() void
    }
    class Dog {
      +String breed
      +fetch() void
    }
    class Cat {
      +bool indoor
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
  },
  {
    id: "state",
    label: "State",
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch
    Loading --> Success : 200
    Loading --> Error : 4xx / 5xx
    Success --> Idle : reset
    Error --> Loading : retry
    Success --> [*]`,
  },
  {
    id: "er",
    label: "Entity Relationship",
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    CUSTOMER {
      string name
      string email
    }
    ORDER {
      int id
      date createdAt
    }
    PRODUCT ||--o{ LINE_ITEM : "ordered in"`,
  },
  {
    id: "gantt",
    label: "Gantt",
    code: `gantt
    title Project plan
    dateFormat YYYY-MM-DD
    section Design
    Research      :done,    des1, 2024-01-01, 7d
    Wireframes    :active,  des2, after des1, 5d
    section Build
    Frontend      :         dev1, after des2, 10d
    Backend       :         dev2, after des2, 12d
    section Launch
    QA & release  :         rel1, after dev1, 4d`,
  },
  {
    id: "pie",
    label: "Pie",
    code: `pie showData
    title Favorite languages
    "TypeScript" : 45
    "Python" : 30
    "Rust" : 15
    "Go" : 10`,
  },
  {
    id: "mindmap",
    label: "Mind map",
    code: `mindmap
  root((Mermaid))
    Diagrams
      Flowchart
      Sequence
      Class
    Features
      Themes
      Fonts
      Export
        SVG
        PNG`,
  },
  {
    id: "gitgraph",
    label: "Git graph",
    code: `gitGraph
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit
    branch feature
    checkout feature
    commit`,
  },
];

export const DEFAULT_TEMPLATE_CODE = TEMPLATES[0].code;
